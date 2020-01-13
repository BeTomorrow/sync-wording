#!/usr/bin/env node

import chalk from "chalk";
import clear from "clear";
import figlet from "figlet";
import program from "commander";
import { GoogleAuth } from "./google/GoogleAuth";
import { Drive } from "./google/Drive";
import { WordingLoader } from "./WordingLoader";
import { WordingExporter } from "./WordingExporter";
import { loadConfiguration } from "./config/WordingConfigLoader";

console.log("Running sync wording");

program
  .version("1.0.0")
  .description("Upgrade application wording from Google Sheet")
  .option("--config <config>", "wording config path", "wording_config.json")
  .option("--upgrade", "upgrade wording from remote Google Sheet")
  .option("--update", "update wording from local xlsx")
  .option("-v, --verbose", "show verbose logs")
  .parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

loadConfiguration(program.config).then(async config => {
  if (program.verbose) {
    console.log(config);
  }

  if (program.upgrade) {
    console.log("Download wording from Google Drive");
    const auth = await new GoogleAuth().authorize(config.credentials, [
      "https://www.googleapis.com/auth/drive.readonly"
    ]);

    await new Drive(auth).exportAsXlsx(
      config.sheetId,
      config.wording_file,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }

  if (program.upgrade || program.update) {
    console.log("Updating wording files");
    const loader = new WordingLoader(
      config.wording_file,
      config.sheetNames,
      config.sheetStartIndex
    );

    const exporter = new WordingExporter();

    config.languages.forEach(language => {
      const wording = loader.loadWording(language.column);
      exporter.export(wording, language.output);
    });
  }
});
