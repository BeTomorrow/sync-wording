#!/usr/bin/env node

import colors from "colors/safe";
import { program } from "commander";
import readline from "readline/promises";
import { runCheck } from "./commands/check";
import { isInteractive, runInit } from "./commands/init";
import { TargetConfig, WordingConfig } from "./config/WordingConfig";
import { loadConfiguration } from "./config/WordingConfigLoader";
import { AuthRequiredError, ConfigError, EXIT_CODES } from "./errors";
import { AngularJsonWordingExporter } from "./exporters/AngularJsonWordingExporter";
import { FlatJsonWordingExporter } from "./exporters/FlatJsonWordingExportter";
import { NestedJsonWordingExporter } from "./exporters/NestedJsonWordingExporter";
import { WordingExporter } from "./exporters/WordingExporter";
import { Drive, SheetWriteConfig } from "./google/Drive";
import { GoogleAuth, hasStoredToken } from "./google/GoogleAuth";
import { parseWordingLines } from "./utils";
import { WordingLoader, WordingResult } from "./WordingLoader";

// Least privilege: read-only Drive access (xlsx export of the sheet)
// and Sheets read/write (--add / --set / --remove).
const scopes = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
];

function getExporter(format: String): WordingExporter {
  if (format === "angular-json") {
    return new AngularJsonWordingExporter();
  } else if (format === "flat-json") {
    return new FlatJsonWordingExporter();
  }
  return new NestedJsonWordingExporter();
}

function printReport(
  target: TargetConfig,
  language: string,
  result: WordingResult,
): void {
  if (result.hasInvalidKeys) {
    console.warn(
      colors.yellow(
        `Invalid translations found for target "${target.name}", language "${language}":`,
      ),
    );
    result.invalidKeys.forEach((k) => console.warn(colors.yellow(`\t"${k}"`)));
  }
}

/**
 * Requires an unambiguous single target for sheet-mutating commands
 * (--add / --set): with multiple targets, --target must be provided.
 */
function requireSingleTarget(
  config: WordingConfig,
  targets: TargetConfig[],
  command: string,
): TargetConfig {
  if (targets.length > 1) {
    const available = config.targets.map((t) => t.name).join(", ");
    throw new ConfigError(
      `${command} needs a single target but the configuration defines several. ` +
        `Use --target <name> (available: ${available})`,
    );
  }
  return targets[0];
}

function sheetWriteConfig(target: TargetConfig): SheetWriteConfig {
  return {
    keyColumn: target.keyColumn,
    languages: target.languages,
    sheetStartIndex: target.sheetStartIndex,
  };
}

/**
 * A --sheet-name outside the target's sheets would write translations
 * with the wrong column mapping: reject it upfront.
 */
function validateSheetNameInTarget(
  sheetName: string,
  target: TargetConfig,
  command: string,
): void {
  if (
    target.sheetNames &&
    target.sheetNames.length > 0 &&
    !target.sheetNames.includes(sheetName)
  ) {
    throw new ConfigError(
      `Sheet "${sheetName}" is not part of target "${target.name}" ` +
        `(sheets: ${target.sheetNames.join(", ")}). ` +
        `${command} would write with the wrong columns — use the matching --target or fix --sheet-name`,
    );
  }
}

function resolveAddSheetName(target: TargetConfig, options: any): string {
  if (options.sheetName) {
    validateSheetNameInTarget(options.sheetName, target, "--add");
    return options.sheetName;
  }
  const first = target.sheetNames?.[0];
  if (!first) {
    throw new ConfigError(
      `--add needs a sheet to write to: pass --sheet-name <name> or set "sheetNames" in the configuration`,
    );
  }
  return first;
}

function resolveSearchSheetNames(
  target: TargetConfig,
  options: any,
  command: string,
): string[] | undefined {
  if (options.sheetName) {
    validateSheetNameInTarget(options.sheetName, target, command);
    return [options.sheetName];
  }
  // undefined lets Drive search every tab of the document
  return target.sheetNames;
}

async function runSync(options: any): Promise<void> {
  const config = await loadConfiguration(options.config);
  if (options.verbose) {
    console.log(config);
  }

  const targets = config.selectTargets(options.target);

  // One action per invocation: the blocks below are independent `if`s, so
  // without this guard `--add … --set …` would run several sheet writes (and
  // re-authenticate) in one run, and `--check --add …` would silently drop the
  // mutation (check returns first).
  const actions = [
    options.check && "--check",
    options.add && "--add",
    options.set && "--set",
    options.remove && "--remove",
    (options.upgrade || options.update) &&
      (options.upgrade ? "--upgrade" : "--update"),
  ].filter(Boolean);
  if (actions.length > 1) {
    throw new ConfigError(
      `Only one action can run at a time, got: ${actions.join(", ")}. ` +
        `Run them as separate commands.`,
    );
  }

  if (options.check) {
    const report = runCheck(config, targets);
    if (report.hasInvalidKeys && options.invalid === "error") {
      process.exitCode = EXIT_CODES.INVALID_WORDINGS;
    }
    return;
  }

  if (options.add) {
    const target = requireSingleTarget(config, targets, "--add");
    const sheetName = resolveAddSheetName(target, options);
    const lines = parseWordingLines(options.add, target.languages.length);
    const auth = await new GoogleAuth().authorize(config.credentials, scopes);
    await new Drive(auth).addLines(
      config.sheetId,
      sheetName,
      lines,
      sheetWriteConfig(target),
    );
  }

  if (options.set) {
    const target = requireSingleTarget(config, targets, "--set");
    const sheetNames = resolveSearchSheetNames(target, options, "--set");
    const lines = parseWordingLines(options.set, target.languages.length, "--set");
    const auth = await new GoogleAuth().authorize(config.credentials, scopes);
    await new Drive(auth).updateLines(
      config.sheetId,
      sheetNames,
      lines,
      sheetWriteConfig(target),
    );
  }

  if (options.remove) {
    const target = requireSingleTarget(config, targets, "--remove");
    const sheetNames = resolveSearchSheetNames(target, options, "--remove");
    const auth = await new GoogleAuth().authorize(config.credentials, scopes);
    await new Drive(auth).removeLines(
      config.sheetId,
      sheetNames,
      options.remove,
      sheetWriteConfig(target),
    );
  }

  if (options.upgrade) {
    console.log("Download wording from Google Drive");
    const auth = await new GoogleAuth().authorize(config.credentials, scopes);

    await new Drive(auth).exportAsXlsx(
      config.sheetId,
      config.wording_file,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  }

  if (options.upgrade || options.update) {
    console.log("Updating wording files");
    const loader = new WordingLoader(config.wording_file);

    // Validate every target's sheets upfront so a bad target
    // fails the whole run before any file is written.
    targets.forEach((target) => loader.resolveSheetNames(target));

    let hasError = false;
    let filesWritten = 0;
    const summaryLines: string[] = [];

    for (const target of targets) {
      const exporter = getExporter(target.format);
      for (const language of target.languages) {
        const result = loader.loadWording(target, language);
        await exporter.export(language.name, result.wordings, language.output);
        printReport(target, language.name, result);
        hasError = hasError || result.hasInvalidKeys;
        filesWritten++;
        const invalidNote =
          result.invalidKeys.length > 0
            ? `, ${result.invalidKeys.length} invalid`
            : "";
        summaryLines.push(
          `  [${target.name}] ${language.name}: ${result.wordings.size} keys${invalidNote} → ${language.output}`,
        );
      }
    }

    console.log("\nSummary:");
    summaryLines.forEach((line) => console.log(line));
    console.log(`${filesWritten} file(s) written`);

    if (hasError && options.invalid === "error") {
      process.exitCode = EXIT_CODES.INVALID_WORDINGS;
    }
  }
}

/**
 * Validate the freshly scaffolded configuration: parse it and report what a
 * sync would produce, without writing anything. Surfaces a broken config
 * immediately rather than at the first real sync.
 */
async function runInitCheck(options: any): Promise<void> {
  console.log(`\nValidating configuration...`);
  const config = await loadConfiguration(options.config);
  const targets = config.selectTargets(options.target);
  runCheck(config, targets);
}

/**
 * Interactive follow-up after init: walk the user through authentication
 * and a first sync, so a single command goes from zero to generated files.
 * Skipped entirely in non-interactive contexts (CI, agents).
 */
async function postInitGuidance(options: any): Promise<void> {
  if (!isInteractive()) {
    console.log(`Next steps:`);
    console.log(`  - review ${options.config}`);
    console.log(`  - run "sync-wording auth" if not authenticated yet`);
    console.log(`  - run "sync-wording --check" to validate the setup`);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    if (!hasStoredToken()) {
      const answer = (
        await rl.question("Authenticate with Google now (opens a browser)? [Y/n] ")
      )
        .trim()
        .toLowerCase();
      if (["", "y", "yes", "o", "oui"].includes(answer)) {
        await runAuth(options);
      } else {
        console.log(`Skipped — run "sync-wording auth" before the first sync.`);
        return;
      }
    }

    const answer = (
      await rl.question("Run a first sync now (download + generate files)? [Y/n] ")
    )
      .trim()
      .toLowerCase();
    if (["", "y", "yes", "o", "oui"].includes(answer)) {
      await runSync({
        config: options.config,
        upgrade: true,
        invalid: "warning",
      });
    } else {
      console.log(`Skipped — run "sync-wording --upgrade" when ready.`);
    }
  } finally {
    rl.close();
  }
}

async function runAuth(options: any): Promise<void> {
  let credentials = "";
  try {
    const config = await loadConfiguration(options.config);
    credentials = config.credentials;
  } catch (e) {
    // No readable configuration: fall back to embedded credentials so
    // authentication can happen before the config file exists.
  }
  await new GoogleAuth().login(credentials, scopes);
  console.log(colors.green("Authentication successful"));
}

function fail(error: any): void {
  if (error instanceof ConfigError) {
    console.error(colors.red(`Configuration error: ${error.message}`));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }
  if (error instanceof AuthRequiredError) {
    console.error(colors.red(`Authentication error: ${error.message}`));
    process.exit(EXIT_CODES.AUTH_ERROR);
  }
  // Google Drive answers 404 both for a wrong id and for a sheet
  // the authenticated account can't access.
  if (error?.code === 404 || error?.response?.status === 404) {
    console.error(
      colors.red(
        `Configuration error: Google Sheet not found. Check that "sheetId" is correct ` +
          `and that the sheet is shared with the authenticated Google account.`,
      ),
    );
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }
  console.error(colors.red(`Unexpected error: ${error?.message ?? error}`));
  process.exit(EXIT_CODES.UNEXPECTED_ERROR);
}

program
  .name("sync-wording")
  .description("Upgrade application wording from Google Sheet")
  // Required so "auth"/"init" parse their own --config/--target options
  // instead of the root command capturing them.
  .enablePositionalOptions()
  .option(
    "--add <key> <values...>",
    "add wording line(s) to remote Google Sheet (key followed by one value per language; repeat the pattern for multiple lines)",
  )
  .option(
    "--set <key> <values...>",
    "update wording line(s) in remote Google Sheet by key (key followed by one value per language; repeat the pattern for multiple lines)",
  )
  .option(
    "--remove <keys...>",
    "remove wording line(s) from remote Google Sheet by key (deletes the whole row; repeat keys for multiple lines)",
  )
  .option(
    "--sheet-name <name>",
    "sheet tab for --add / --set / --remove; must belong to the selected target (--add default: first sheetNames entry, --set/--remove default: search all target sheets)",
  )
  .option("--config <config>", "wording config path", "wording_config.json")
  .option("--target <name>", "restrict the command to a single target")
  .option("--upgrade", "upgrade wording from remote Google Sheet")
  .option("--update", "update wording from local xlsx")
  .option(
    "--check",
    "validate configuration and report what would be written, without writing",
  )
  .option(
    "--invalid <invalid>",
    "error|warning on invalid translation",
    "warning",
  )
  .option("-v, --verbose", "show verbose logs")
  .action((options) => runSync(options).catch(fail));

program
  .command("auth")
  .description("authenticate to Google interactively and store the access token")
  .option("--config <config>", "wording config path", "wording_config.json")
  .action((options) => runAuth(options).catch(fail));

program
  .command("init")
  .description(
    "scaffold wording_config.json and wire AI agent skill references",
  )
  .option("--config <config>", "wording config path", "wording_config.json")
  .option("--sheet-id <id>", "Google Sheet document id")
  .option(
    "--languages <spec>",
    "language:column pairs, e.g. fr:D,en:C",
  )
  .option("--sheet-names <names>", "comma-separated sheet (tab) names")
  .option("--format <format>", "output format (json|flat-json|angular-json)")
  .option("--output-dir <dir>", "output directory for generated files")
  .option("--key-column <column>", "column containing wording keys")
  .option(
    "--target <name>",
    "create or add a named target instead of a flat configuration",
  )
  .option("--skip-agents", "do not create/update AI agent entry point files")
  .option(
    "--write-agents",
    "create AGENTS.md from scratch when absent instead of printing the snippet",
  )
  .action((options) =>
    runInit(options)
      .then(() => runInitCheck(options))
      .then(() => postInitGuidance(options))
      .catch(fail),
  );

if (!process.argv.slice(2).length) {
  program.outputHelp();
} else {
  program.parseAsync(process.argv).catch(fail);
}
