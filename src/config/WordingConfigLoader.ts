import fs from "fs";
import { ConfigError } from "../errors";
import { WordingConfig } from "./WordingConfig";

export function loadConfiguration(configPath: string): Promise<WordingConfig> {
  return new Promise((resolve, reject) => {
    fs.readFile(configPath, (err, config) => {
      if (err) {
        reject(
          new ConfigError(
            `Can't read configuration file "${configPath}": ${err.message}. Run "npx sync-wording init" to create one.`,
          ),
        );
        return;
      }
      try {
        resolve(new WordingConfig(JSON.parse(config.toString())));
      } catch (e: any) {
        if (e instanceof ConfigError) {
          reject(new ConfigError(`Invalid configuration "${configPath}": ${e.message}`));
        } else {
          reject(new ConfigError(`Invalid JSON in "${configPath}": ${e.message}`));
        }
      }
    });
  });
}
