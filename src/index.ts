#!/usr/bin/env node

import colors from 'colors/safe';
import { program } from "commander";
import { loadConfiguration } from "./config/WordingConfigLoader";
import { AngularJsonWordingExporter } from "./exporters/AngularJsonWordingExporter";
import { FlatJsonWordingExporter } from "./exporters/FlatJsonWordingExportter";
import { NestedJsonWordingExporter } from "./exporters/NestedJsonWordingExporter";
import { WordingExporter } from "./exporters/WordingExporter";
import { Drive } from "./google/Drive";
import { GoogleAuth } from "./google/GoogleAuth";
import { WordingLoader, WordingResult } from "./WordingLoader";

console.log("Running sync wording");

program
  .description("Upgrade application wording from Google Sheet")
  .option("--add <key> <values...>", "add a wording line to remote Google Sheet")
  .option("--config <config>", "wording config path", "wording_config.json")
  .option("--upgrade", "upgrade wording from remote Google Sheet")
  .option("--update", "update wording from local xlsx")
  .option("--invalid <invalid>", "error|warning on invalid translation", "warning")
  .option("-v, --verbose", "show verbose logs")
  .parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

function getExporter(format: String) : WordingExporter {
  if (format === "angular-json") {
    return new AngularJsonWordingExporter()
  } else if (format === "flat-json") {
    return new FlatJsonWordingExporter();
  }
  return new NestedJsonWordingExporter();
}

function printReport(language: string, result : WordingResult) : void {
  if (result.hasInvalidKeys) {
    console.warn(colors.yellow(`Invalid translations found for language : ${language}`))
    result.invalidKeys.forEach((k) =>
      console.warn(colors.yellow(`\t"${k}"`))
    )
  }
};

const options = program.opts();

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
    const [key, ...values] = options.add;
    const auth = await new GoogleAuth().authorize(config.credentials, scopes);
    await new Drive(auth).addLine(config.sheetId, config.sheetNames[0], key, ...values);
  }

  if (options.upgrade) {
    console.log("Download wording from Google Drive");
    const auth = await new GoogleAuth().authorize(config.credentials, scopes);

    await new Drive(auth).exportAsXlsx(
      config.sheetId,
      config.wording_file,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }

  if (options.upgrade || options.update) {
    console.log("Updating wording files");
    const loader = new WordingLoader(config);

    const exporter = getExporter(config.format);
    let hasError = false
    config.languages.forEach(language => {
      const result = loader.loadWording(language, config.ignoreEmptyKeys);
      exporter.export(language.name, result.wordings, language.output);
      printReport(language.name, result)
      hasError = hasError || result.hasInvalidKeys
    });

    if (hasError && options.invalid === "error") {
      process.exitCode = 1
    }
  }
});


