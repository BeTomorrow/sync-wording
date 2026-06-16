import fs from "fs";
import xlsx, { WorkBook, WorkSheet } from "xlsx";
import { LanguageConfig, TargetConfig } from "./config/WordingConfig";
import { ConfigError } from "./errors";

interface Entry {
  key: string;
  value: string;
}

export class WordingResult {
  public readonly hasInvalidKeys: boolean;
  public readonly invalidKeys: string[];

  constructor(
    public wordings: Map<string, string>,
    public validations: Map<string, boolean>,
  ) {
    const invalidKeys: string[] = [];
    this.validations.forEach((value, key) => {
      if (!value) {
        invalidKeys.push(key);
      }
    });
    this.invalidKeys = invalidKeys;
    this.hasInvalidKeys = invalidKeys.length > 0;
  }
}

export class WordingLoader {
  private workbook: WorkBook;

  constructor(wordingFile: string) {
    if (!fs.existsSync(wordingFile)) {
      throw new ConfigError(
        `Wording file "${wordingFile}" not found. Run "npx sync-wording --upgrade" to download it from Google Sheet.`,
      );
    }
    this.workbook = xlsx.readFile(wordingFile);
  }

  resolveSheetNames(target: TargetConfig): string[] {
    if (target.sheetNames && target.sheetNames.length > 0) {
      const missing = target.sheetNames.filter(
        (name) => !this.workbook.Sheets[name],
      );
      if (missing.length > 0) {
        throw new ConfigError(
          `Sheet(s) not found for target "${target.name}": ${missing.join(", ")}. ` +
            `Available sheets: ${this.workbook.SheetNames.join(", ")}`,
        );
      }
      return target.sheetNames;
    }
    return this.workbook.SheetNames;
  }

  loadWording(target: TargetConfig, language: LanguageConfig): WordingResult {
    const wordings = new Map<string, string>();
    const validations = new Map<string, boolean>();
    for (const sheetName of this.resolveSheetNames(target)) {
      const sheet = this.workbook.Sheets[sheetName];
      this.addWording(sheet, target, language, wordings, validations);
    }
    return new WordingResult(wordings, validations);
  }

  private addWording(
    sheet: WorkSheet,
    target: TargetConfig,
    language: LanguageConfig,
    wordings: Map<string, string>,
    validations: Map<string, boolean>,
  ) {
    // Scan the whole used range: an empty spacer row must not silently
    // truncate everything below it.
    const range = xlsx.utils.decode_range(sheet["!ref"] ?? "A1:A1");
    const lastRow = range.e.r + 1;

    for (
      let rowIndex = target.sheetStartIndex;
      rowIndex <= lastRow;
      rowIndex++
    ) {
      const row = this.readRow(sheet, target.keyColumn, language.column, rowIndex);
      if (row === undefined) {
        continue;
      }

      if (!target.ignoreEmptyKeys) {
        wordings.set(row.key, row.value);
      } else if (row.value != undefined && row.value.length > 0) {
        wordings.set(row.key, row.value);
      }

      if (language.validation && language.validation?.column) {
        const isValid =
          this.readRow(sheet, target.keyColumn, language.validation?.column, rowIndex)
            ?.value === language.validation.expected;
        validations.set(row.key, isValid);
      }
    }
  }

  private readRow(
    sheet: WorkSheet,
    keyColumn: string,
    column: string,
    rowIndex: number,
  ): Entry | undefined {
    const key = sheet[`${keyColumn}${rowIndex}`];
    const value = sheet[`${column}${rowIndex}`];
    if (key === undefined) {
      return undefined;
    }
    return {
      key: key.v,
      value: value ? value.v : "",
    };
  }
}
