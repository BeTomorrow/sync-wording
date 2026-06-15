import colors from "colors/safe";
import fs from "fs";
import { TargetConfig, WordingConfig } from "../config/WordingConfig";
import { WordingLoader } from "../WordingLoader";

export interface CheckReport {
  hasInvalidKeys: boolean;
}

/**
 * Validates the configuration and reports what a sync would produce,
 * without writing any output file. Reads the local xlsx if present.
 */
export function runCheck(
  config: WordingConfig,
  targets: TargetConfig[],
): CheckReport {
  console.log(`sheetId: ${config.sheetId}`);

  const xlsxExists = fs.existsSync(config.wording_file);
  console.log(
    `wording file: ${config.wording_file} ${xlsxExists ? "(present)" : "(missing — run --upgrade to download it)"}`,
  );

  let hasInvalidKeys = false;
  const loader = xlsxExists ? new WordingLoader(config.wording_file) : null;

  for (const target of targets) {
    console.log(`\ntarget "${target.name}":`);
    console.log(
      `  sheets: ${target.sheetNames ? target.sheetNames.join(", ") : "(all)"}`,
    );
    console.log(`  format: ${target.format}`);

    for (const language of target.languages) {
      if (loader) {
        const result = loader.loadWording(target, language);
        const invalid = result.invalidKeys.length;
        const invalidNote = invalid > 0 ? `, ${invalid} invalid` : "";
        console.log(
          `  ${language.name}: ${result.wordings.size} keys${invalidNote} → ${language.output}`,
        );
        if (result.hasInvalidKeys) {
          hasInvalidKeys = true;
          result.invalidKeys.forEach((k) =>
            console.log(colors.yellow(`    invalid: "${k}"`)),
          );
        }
      } else {
        console.log(`  ${language.name}: column ${language.column} → ${language.output}`);
      }
    }
  }

  if (hasInvalidKeys) {
    console.log(colors.yellow(`\nCheck completed with invalid translations`));
  } else {
    console.log(colors.green(`\nCheck OK`));
  }
  return { hasInvalidKeys };
}
