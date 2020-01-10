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

clear();
console.log(
  chalk.red(
    figlet.textSync("Wording", {
      horizontalLayout: "full"
    })
  )
);

program
  .version("0.0.1")
  .description("Upgrade application wording from Google Sheet")
  .option("--config <config>", "wording config path", "wording_config.json")
  .option("--upgrade", "upgrade wording from remote Google Sheet")
  .option("--update", "update wording from local xlsx")
  .parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

console.log(
  "Update : " +
    program.update +
    ", upgrade : " +
    program.upgrade +
    ", languages : " +
    program.languages
);

loadConfiguration(program.config).then(async config => {
  // const auth = await new GoogleAuth().authorize(config.credentials, [
  //   "https://www.googleapis.com/auth/drive.readonly"
  // ]);

  // await new Drive(auth).exportAsXlsx(
  //   config.sheetId,
  //   config.wording_file,
  //   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  // );

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
});
