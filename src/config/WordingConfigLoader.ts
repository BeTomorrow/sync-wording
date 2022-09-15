import fs from "fs";
import { WordingConfig } from "./WordingConfig";

export function loadConfiguration(configPath: string): Promise<WordingConfig> {
  return new Promise(async (resolve, reject) => {
    fs.readFile(configPath, (err, config) => {
      if (err) {
        console.log("Can't read configuration", err);
        throw Error("Can't read configuration")
      } else {
        const result = new WordingConfig(JSON.parse(config.toString()));
        resolve(result);
      }
    });
  });
}
