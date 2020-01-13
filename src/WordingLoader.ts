import xlsx, { WorkBook, WorkSheet } from "xlsx";

interface Entry {
  key: string;
  value: string;
}

export class WordingLoader {
  private workbook: WorkBook;
  private sheetNames: string[];

  constructor(
    inputPath: string,
    sheetNames: string[],
    private readonly startIndex: number
  ) {
    this.workbook = xlsx.readFile(inputPath);
    if (sheetNames && sheetNames.length > 0) {
      this.sheetNames = sheetNames;
    } else {
      this.sheetNames = this.workbook.SheetNames;
    }
  }

  loadWording(column: string): Map<string, string> {
    const wordings = new Map<string, string>();
    for (const sheetName of this.sheetNames) {
      const sheet = this.workbook.Sheets[sheetName];
      this.addWording(sheet, column, wordings);
    }
    return wordings;
  }

  private addWording(
    sheet: WorkSheet,
    column: string,
    wordings: Map<string, string>
  ) {
    let row: Entry | undefined;
    let rowIndex = this.startIndex;
    while ((row = this.readRow(sheet, column, rowIndex)) !== undefined) {
      wordings.set(row.key, row.value);
      rowIndex++;
    }
  }

  private readRow(
    sheet: WorkSheet,
    column: string,
    rowIndex: number
  ): Entry | undefined {
    const key = sheet[`A${rowIndex}`];
    const value = sheet[`${column}${rowIndex}`];
    if (key === undefined) {
      return undefined;
    }
    return {
      key: key.v,
      value: value.v ? value.v : ""
    };
  }
}
