import fs from "fs";
import { WordingConfig } from "./WordingConfig";

export function loadConfiguration(configPath: string): Promise<WordingConfig> {
  return new Promise(async (resolve, reject) => {
    fs.readFile(configPath, (err, config) => {
      if (err) {
        console.log("Can't read configuration", err);
        resolve(undefined);
      } else {
        const result = new WordingConfig(JSON.parse(config.toString()));
        resolve(result);
      }
    });
  });
}
