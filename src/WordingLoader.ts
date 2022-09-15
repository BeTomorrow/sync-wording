import xlsx, { WorkBook, WorkSheet } from "xlsx";
import { LanguageConfig, WordingConfig } from "./config/WordingConfig";

interface Entry {
  key: string;
  value: string;
}

export class WordingResult {

  public readonly hasInvalidKeys : boolean;
  public readonly invalidKeys : string[];

  constructor(
    public wordings : Map<string, string>,
    public validations : Map<string, boolean>
  ) {
    const invalidKeys : string[] = []
    this.validations.forEach((value, key) => {
      if (!value) {
        invalidKeys.push(key)
      }
    });
    this.invalidKeys = invalidKeys;
    this.hasInvalidKeys = invalidKeys.length > 0
  }
}

export class WordingLoader {

  private workbook: WorkBook;
  private sheetNames: string[];

  constructor(
    private config : WordingConfig,
  ) {
    this.workbook = xlsx.readFile(this.config.wording_file);
    if (this.config.sheetNames && this.config.sheetNames.length > 0) {
      this.sheetNames = this.config.sheetNames;
    } else {
      this.sheetNames = this.workbook.SheetNames;
    }
  }

  loadWording(language: LanguageConfig, ignoreEmptyKeys: boolean): WordingResult {
    const wordings = new Map<string, string>();
    const validations = new Map<string, boolean>();
    for (const sheetName of this.sheetNames) {
      const sheet = this.workbook.Sheets[sheetName];
      this.addWording(sheet, language, wordings, validations, ignoreEmptyKeys);
    }
    return new WordingResult(wordings, validations);
  }

  private addWording(
    sheet: WorkSheet,
    language: LanguageConfig,
    wordings: Map<string, string>,
    validations: Map<string, boolean>,
    ignoreEmptyKeys: boolean
  ) {
    let row: Entry | undefined;
    let rowIndex = this.config.sheetStartIndex;
    while ((row = this.readRow(sheet, this.config.keyColumn, language.column, rowIndex)) !== undefined) {
      
      if (!ignoreEmptyKeys) {
        wordings.set(row.key, row.value);
      } else if (row.value != undefined && row.value.length > 0) {
        wordings.set(row.key, row.value);
      }

      if (language.validation && language.validation?.column) {
        const isValid = this.readRow(sheet, this.config.keyColumn, language.validation?.column, rowIndex)?.value === language.validation.expected;
        validations.set(row.key, isValid);
      }
      rowIndex++;
    }
  }

  private readRow(
    sheet: WorkSheet,
    keyColumn: string,
    column: string,
    rowIndex: number
  ): Entry | undefined {
    const key = sheet[`${keyColumn}${rowIndex}`];
    const value = sheet[`${column}${rowIndex}`];
    if (key === undefined) {
      return undefined;
    }
    return {
      key: key.v,
      value: value ? value.v : ""
    };
  }
}
