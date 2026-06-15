import colors from "colors/safe";
import fs from "fs";
import readline from "readline/promises";
import { ConfigError } from "../errors";
import {
  AGENTS_MD_CREATE,
  COPILOT_LINE,
  PACKAGED_SKILL_PATH,
  WORDING_SECTION,
} from "./templates";

export interface InitOptions {
  config: string;
  sheetId?: string;
  languages?: string;
  sheetNames?: string;
  format?: string;
  outputDir?: string;
  keyColumn?: string;
  target?: string;
  skipAgents?: boolean;
  writeAgents?: boolean;
}

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Accepts either a bare sheet id or a full Google Sheet URL
 * (https://docs.google.com/spreadsheets/d/<id>/edit...).
 */
function extractSheetId(input: string): string {
  const match = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input;
}

async function promptMissingOptions(options: InitOptions): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    while (!options.sheetId) {
      const answer = (
        await rl.question("Google Sheet id (or full URL): ")
      ).trim();
      if (answer) {
        options.sheetId = extractSheetId(answer);
      }
    }

    while (!options.languages) {
      const answer = (
        await rl.question("Languages as language:column pairs (e.g. fr:D,en:C): ")
      ).trim();
      try {
        parseLanguages(answer);
        options.languages = answer;
      } catch (e: any) {
        console.log(colors.yellow(e.message));
      }
    }

    if (options.sheetNames === undefined) {
      const answer = (
        await rl.question("Sheet tabs to read, comma-separated (empty = all tabs): ")
      ).trim();
      if (answer) {
        options.sheetNames = answer;
      }
    }

    if (!options.format) {
      const formats = ["json", "flat-json", "angular-json"];
      while (true) {
        const answer = (
          await rl.question(`Output format [${formats.join("|")}] (json): `)
        ).trim();
        if (!answer || formats.includes(answer)) {
          if (answer && answer !== "json") {
            options.format = answer;
          }
          break;
        }
        console.log(colors.yellow(`Unknown format "${answer}"`));
      }
    }

    if (!options.outputDir) {
      const answer = (
        await rl.question("Output directory (./src/assets/strings/): ")
      ).trim();
      if (answer) {
        options.outputDir = answer;
      }
    }
  } finally {
    rl.close();
  }
}

export async function runInit(options: InitOptions): Promise<void> {
  const configExists = fs.existsSync(options.config);
  // An existing config that was never wired to the skill means this is very
  // likely a project upgrading from 1.x — capture it before we wire anything.
  const isUpgrade = configExists && !isSkillAlreadyWired();

  if (!configExists) {
    if (isInteractive() && (!options.sheetId || !options.languages)) {
      console.log(
        `No configuration found at "${options.config}" — let's create it.`,
      );
      await promptMissingOptions(options);
    }
    createConfig(options);
  } else if (options.target) {
    addTarget(options);
  } else {
    console.log(`${options.config} already exists, leaving it untouched`);
  }

  if (!options.skipAgents) {
    await wireAgentEntryPoints(options);
  }

  // The notice belongs to the agent-integration flow: skip it entirely when
  // the user opted out (--skip-agents), otherwise it would never dedup (the
  // skill is never wired) and would reprint on every run.
  if (isUpgrade && !options.skipAgents && !options.target) {
    printUpgradeNotice();
  }

  console.log(colors.green("Init done."));
}

/**
 * True if any umbrella file already points to the packaged skill — used to
 * tell a fresh setup apart from a project upgrading from an earlier version.
 */
function isSkillAlreadyWired(): boolean {
  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    if (
      fs.existsSync(file) &&
      fs.readFileSync(file).toString().includes(PACKAGED_SKILL_PATH)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Shown once when init runs against a pre-existing, not-yet-wired project.
 * Reassures about backward compatibility (so neither the user nor an agent
 * rewrites a working setup) and surfaces what 2.x adds.
 */
function printUpgradeNotice(): void {
  console.log(
    colors.cyan(
      "\nExisting project detected — looks like an upgrade to sync-wording 2.x.",
    ) +
      "\n  - Your wording_config.json works as-is: the flat (single-target) shape is" +
      "\n    still fully supported. Do NOT convert it to multiple targets unless you" +
      "\n    actually need several syncs from one document." +
      "\n  - Auth is now explicit and non-interactive. Any token you already stored" +
      '\n    keeps working; if a sync fails with exit 3, run "npx sync-wording auth" once.' +
      "\n  - New in 2.x: --check (dry-run validation), --set / --remove, multiple" +
      "\n    targets, and the AI agent skill pointer handled above.",
  );
}


function buildTargetJson(options: InitOptions): any {
  const target: any = {};
  if (options.sheetNames) {
    target.sheetNames = options.sheetNames.split(",").map((s) => s.trim());
  }
  if (options.format) {
    target.format = options.format;
  }
  if (options.outputDir) {
    target.output_dir = options.outputDir;
  }
  if (options.keyColumn) {
    target.keyColumn = options.keyColumn;
  }
  target.languages = parseLanguages(options.languages);
  return target;
}

function parseLanguages(spec: string | undefined): any {
  if (!spec) {
    throw new ConfigError(
      `Missing --languages. Expected format: --languages fr:D,en:C (language:column pairs)`,
    );
  }
  const languages: any = {};
  for (const pair of spec.split(",")) {
    const [name, column] = pair.split(":").map((s) => s.trim());
    if (!name || !column) {
      throw new ConfigError(
        `Invalid --languages entry "${pair}". Expected format: fr:D,en:C`,
      );
    }
    languages[name] = { column };
  }
  return languages;
}

function createConfig(options: InitOptions): void {
  if (!options.sheetId) {
    throw new ConfigError(
      `No configuration found at "${options.config}".\n` +
        `  - To create one:           sync-wording init --sheet-id <id> --languages fr:D,en:C\n` +
        `  - If one exists elsewhere: sync-wording init --config <path>`,
    );
  }

  const target = buildTargetJson(options);
  let config: any;
  if (options.target) {
    config = {
      sheetId: options.sheetId,
      targets: { [options.target]: target },
    };
  } else {
    config = { sheetId: options.sheetId, ...target };
  }

  writeJson(options.config, config);
  console.log(`${options.config} created`);
}

function addTarget(options: InitOptions): void {
  let json: any;
  try {
    json = JSON.parse(fs.readFileSync(options.config).toString());
  } catch (e: any) {
    throw new ConfigError(
      `Can't parse "${options.config}": ${e.message}`,
    );
  }

  if (!json.targets) {
    // Migrate the flat shape: move target-level fields into targets.default,
    // keep document-level fields (sheetId, credentials, wording_file) at the top.
    const documentKeys = ["sheetId", "credentials", "wording_file"];
    const defaultTarget: any = {};
    for (const key of Object.keys(json)) {
      if (!documentKeys.includes(key)) {
        defaultTarget[key] = json[key];
        delete json[key];
      }
    }
    json.targets = { default: defaultTarget };
    console.log(`Migrated flat configuration to a "default" target`);
  }

  if (json.targets[options.target!]) {
    throw new ConfigError(
      `Target "${options.target}" already exists in ${options.config}`,
    );
  }

  json.targets[options.target!] = buildTargetJson(options);
  writeJson(options.config, json);
  console.log(`Target "${options.target}" added to ${options.config}`);
}

function writeJson(filePath: string, json: any): void {
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n");
}

async function wireAgentEntryPoints(options: InitOptions): Promise<void> {
  // AGENTS.md: cross-agent standard (Codex, Cursor, Amp, Zed, ...) — also
  // read by Claude Code and Cursor (since 1.3), so it has the widest reach.
  // Append to an existing file (low intrusion); never seed a project's
  // top-level agent guide from scratch silently — that is an explicit choice.
  if (!appendPointer("AGENTS.md")) {
    await offerAgentsFile(options);
  }

  // Claude Code: same lazy pointer, but only when CLAUDE.md already exists.
  // We never create it from scratch — Claude Code reads AGENTS.md too.
  // The marker is the bare path so a CLAUDE.md symlinked to AGENTS.md
  // is detected as already wired and never double-appended.
  appendPointer("CLAUDE.md");

  // GitHub Copilot: only if the project already uses it (.github present).
  if (fs.existsSync(".github")) {
    ensureLine(
      ".github/copilot-instructions.md",
      PACKAGED_SKILL_PATH,
      `\n${COPILOT_LINE}`,
      COPILOT_LINE,
    );
  }
}

/**
 * Append the lazy skill pointer to an umbrella file, but only if it exists.
 * Returns whether the file was present (whether or not it needed the pointer).
 */
function appendPointer(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const content = fs.readFileSync(filePath).toString();
  if (!content.includes(PACKAGED_SKILL_PATH)) {
    fs.appendFileSync(filePath, WORDING_SECTION);
    console.log(`${filePath} updated with skill reference`);
  }
  return true;
}

/**
 * No AGENTS.md yet. Creating one appropriates the project's top-level agent
 * guide, so require an explicit opt-in: --write-agents, or an interactive
 * yes. Otherwise print the snippet so the agent running init (or the user)
 * can wire it deliberately — discoverability without intrusion.
 */
async function offerAgentsFile(options: InitOptions): Promise<void> {
  if (options.writeAgents) {
    createAgentsFile();
    return;
  }
  if (isInteractive()) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      const answer = (
        await rl.question(
          "No AGENTS.md found. Create one with a wording pointer? [y/N] ",
        )
      )
        .trim()
        .toLowerCase();
      if (["y", "yes", "o", "oui"].includes(answer)) {
        createAgentsFile();
        return;
      }
    } finally {
      rl.close();
    }
  }
  printAgentsSnippet();
}

function createAgentsFile(): void {
  fs.writeFileSync("AGENTS.md", AGENTS_MD_CREATE);
  console.log(`AGENTS.md created with skill reference`);
}

function printAgentsSnippet(): void {
  console.log(
    colors.yellow(
      "No AGENTS.md found — not creating one (init stays non-intrusive).",
    ) +
      "\nTo let AI agents discover wording sync, add this to AGENTS.md:\n" +
      WORDING_SECTION,
  );
}

function ensureLine(
  filePath: string,
  marker: string,
  appendContent: string,
  createContent: string,
): void {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath).toString();
    if (content.includes(marker)) {
      return;
    }
    fs.appendFileSync(filePath, appendContent);
    console.log(`${filePath} updated with skill reference`);
  } else {
    fs.writeFileSync(filePath, createContent);
    console.log(`${filePath} created with skill reference`);
  }
}
