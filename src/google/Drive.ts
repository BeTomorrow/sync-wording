import fs from "fs";
import { google, drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { LanguageConfig } from "../config/WordingConfig";

export interface SheetWriteConfig {
  keyColumn: string;
  languages: LanguageConfig[];
  sheetStartIndex: number;
}

export class Drive {
  drive: drive_v3.Drive;

  constructor(private readonly auth: OAuth2Client) {
    this.drive = google.drive({ version: "v3", auth });

    this.drive.files.list({});
  }

  listFiles() {
    this.drive.files.list(
      {
        pageSize: 10,
        fields: "nextPageToken, files(id, name)"
      },
      (err, res) => {
        const files = res?.data.files;
        if (files?.length) {
          console.log("Files:");
          files.map(file => {
            console.log(`${file.name} (${file.id})`);
          });
        } else {
          console.log("No files found");
        }
      }
    );
  }

  async addLines(
    spreadsheetId: string,
    sheetName: string,
    lines: { key: string; values: string[] }[],
    writeConfig: SheetWriteConfig
  ) {
    const service = google.sheets({ version: "v4", auth: this.auth });
    const result = await service.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!${writeConfig.keyColumn}:${writeConfig.keyColumn}`,
      valueInputOption: "RAW",
      requestBody: {
        values: lines.map((line) => this.buildAppendRow(line, writeConfig)),
      },
    });

    console.log(
      `${lines.length} line(s) appended (${result.data.updates?.updatedCells} cells).`
    );
    return result;
  }

  async updateLines(
    spreadsheetId: string,
    sheetName: string,
    lines: { key: string; values: string[] }[],
    writeConfig: SheetWriteConfig
  ) {
    const service = google.sheets({ version: "v4", auth: this.auth });
    const keyRows = await this.findKeyRows(
      service,
      spreadsheetId,
      sheetName,
      writeConfig.keyColumn,
      writeConfig.sheetStartIndex
    );

    const updates: { range: string; values: string[][] }[] = [];
    for (const line of lines) {
      const rowIndex = keyRows.get(line.key);
      if (!rowIndex) {
        throw new Error(`Key not found: "${line.key}"`);
      }

      updates.push(
        ...this.buildTranslationUpdates(sheetName, rowIndex, line, writeConfig)
      );
    }

    const result = await service.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    });

    console.log(
      `${lines.length} line(s) updated (${result.data.totalUpdatedCells} cells).`
    );
    return result;
  }

  private validateLine(
    line: { key: string; values: string[] },
    writeConfig: SheetWriteConfig
  ) {
    if (line.values.length !== writeConfig.languages.length) {
      throw new Error(
        `Invalid values for key "${line.key}": expected ${writeConfig.languages.length} translation(s), got ${line.values.length}`
      );
    }
  }

  private buildAppendRow(
    line: { key: string; values: string[] },
    writeConfig: SheetWriteConfig
  ): string[] {
    this.validateLine(line, writeConfig);

    const keyColumnIndex = columnToIndex(writeConfig.keyColumn);
    const languageColumnIndexes = writeConfig.languages.map((language) =>
      columnToIndex(language.column)
    );
    const maxColumnIndex = Math.max(keyColumnIndex, ...languageColumnIndexes);

    const row = new Array<string>(maxColumnIndex - keyColumnIndex + 1).fill("");
    row[0] = line.key;
    writeConfig.languages.forEach((language, index) => {
      const columnOffset = columnToIndex(language.column) - keyColumnIndex;
      if (columnOffset < 0) {
        throw new Error(
          `Language column "${language.column}" must not be before keyColumn "${writeConfig.keyColumn}"`
        );
      }

      row[columnOffset] = line.values[index];
    });

    return row;
  }

  private buildTranslationUpdates(
    sheetName: string,
    rowIndex: number,
    line: { key: string; values: string[] },
    writeConfig: SheetWriteConfig
  ): { range: string; values: string[][] }[] {
    this.validateLine(line, writeConfig);

    return writeConfig.languages.map((language, index) => ({
      range: `${sheetName}!${language.column}${rowIndex}`,
      values: [[line.values[index]]],
    }));
  }

  private async findKeyRows(
    service: ReturnType<typeof google.sheets>,
    spreadsheetId: string,
    sheetName: string,
    keyColumn: string,
    startRow: number
  ): Promise<Map<string, number>> {
    const response = await service.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${keyColumn}${startRow}:${keyColumn}`,
    });

    const keyRows = new Map<string, number>();
    const keys = response.data.values ?? [];
    keys.forEach((row, index) => {
      const key = row[0];
      if (!key) {
        return;
      }

      if (keyRows.has(key)) {
        throw new Error(`Duplicate key "${key}" found in sheet "${sheetName}"`);
      }

      keyRows.set(key, startRow + index);
    });

    return keyRows;
  }

  async exportAsXlsx(fileId: string, output: string, mimeType: string) {
    const dest = fs.createWriteStream(output);
    const res = await this.drive.files.export(
      {
        fileId,
        mimeType
      },
      { responseType: "stream" }
    );
    await new Promise((resolve, reject) => {
      (res.data as any)
        .on("error", reject)
        .pipe(dest)
        .on("error", reject)
        .on("finish", resolve);
    });
  }
}

function columnToIndex(column: string): number {
  let index = 0;
  for (const char of column.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}
