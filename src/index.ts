#!/usr/bin/env node

import program from "commander";
import { loadConfiguration } from "./config/WordingConfigLoader";
import { Drive } from "./google/Drive";
import { GoogleAuth } from "./google/GoogleAuth";
import { FlatJsonWordingExporter } from "./exporters/FlatJsonWordingExportter";
import { NestedJsonWordingExporter } from "./exporters/NestedJsonWordingExporter";
import { AngularJsonWordingExporter } from "./exporters/AngularJsonWordingExporter";
import { WordingLoader } from "./WordingLoader";
import { WordingExporter } from "./exporters/WordingExporter";

console.log("Running sync wording");

program
  .description("Upgrade application wording from Google Sheet")
  .option("--config <config>", "wording config path", "wording_config.json")
  .option("--upgrade", "upgrade wording from remote Google Sheet")
  .option("--update", "update wording from local xlsx")
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

    const exporter = getExporter(config.format);

    config.languages.forEach(language => {
      const wording = loader.loadWording(language.column);
      exporter.export(language.name, wording, language.output);
    });
  }
});


