#!/usr/bin/env node

import colors from "colors/safe";
import { program } from "commander";
import { WordingConfig } from "./config/WordingConfig";
import { loadConfiguration } from "./config/WordingConfigLoader";
import { AngularJsonWordingExporter } from "./exporters/AngularJsonWordingExporter";
import { FlatJsonWordingExporter } from "./exporters/FlatJsonWordingExportter";
import { NestedJsonWordingExporter } from "./exporters/NestedJsonWordingExporter";
import { WordingExporter } from "./exporters/WordingExporter";
import { Drive } from "./google/Drive";
import { GoogleAuth } from "./google/GoogleAuth";
import { parseWordingLines } from "./utils";
import { WordingLoader, WordingResult } from "./WordingLoader";

console.log("Running sync wording");

program
  .description("Upgrade application wording from Google Sheet")
  .option(
    "--add <key> <values...>",
    "add wording line(s) to remote Google Sheet (key followed by one value per language; repeat the pattern for multiple lines)",
  )
  .option(
    "--set <key> <values...>",
    "update wording line(s) in remote Google Sheet by key (key followed by one value per language; repeat the pattern for multiple lines)",
  )
  .option(
    "--sheet <name>",
    "target sheet name for --add / --set (default: first entry in sheetNames)",
  )
  .option("--config <config>", "wording config path", "wording_config.json")
  .option("--upgrade", "upgrade wording from remote Google Sheet")
  .option("--update", "update wording from local xlsx")
  .option(
    "--invalid <invalid>",
    "error|warning on invalid translation",
    "warning",
  )
  .option("-v, --verbose", "show verbose logs")
  .parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

function getExporter(format: String): WordingExporter {
  if (format === "angular-json") {
    return new AngularJsonWordingExporter();
  } else if (format === "flat-json") {
    return new FlatJsonWordingExporter();
  }
  return new NestedJsonWordingExporter();
}

function printReport(language: string, result: WordingResult): void {
  if (result.hasInvalidKeys) {
    console.warn(
      colors.yellow(`Invalid translations found for language : ${language}`),
    );
    result.invalidKeys.forEach((k) => console.warn(colors.yellow(`\t"${k}"`)));
  }
}

const options = program.opts();

function sheetWriteConfig(config: WordingConfig) {
  return {
    keyColumn: config.keyColumn,
    languages: config.languages,
    sheetStartIndex: config.sheetStartIndex,
  };
}

const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];

loadConfiguration(options.config).then(async (config) => {
  if (options.verbose) {
    console.log(config);
  }

  if (options.add) {
    const lines = parseWordingLines(options.add, config.languages.length);
    const sheetName = options.sheet ?? config.sheetNames[0];

    const auth = await new GoogleAuth().authorize(config.credentials, scopes);
    await new Drive(auth).addLines(
      config.sheetId,
      sheetName,
      lines,
      sheetWriteConfig(config),
    );
  }

  if (options.set) {
    const lines = parseWordingLines(options.set, config.languages.length);
    const sheetName = options.sheet ?? config.sheetNames[0];
    const auth = await new GoogleAuth().authorize(config.credentials, scopes);
    await new Drive(auth).updateLines(
      config.sheetId,
      sheetName,
      lines,
      sheetWriteConfig(config),
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
    const loader = new WordingLoader(config);

    const exporter = getExporter(config.format);
    let hasError = false;
    config.languages.forEach((language) => {
      const result = loader.loadWording(language, config.ignoreEmptyKeys);
      exporter.export(language.name, result.wordings, language.output);
      printReport(language.name, result);
      hasError = hasError || result.hasInvalidKeys;
    });

    if (hasError && options.invalid === "error") {
      process.exitCode = 1;
    }
  }
});
