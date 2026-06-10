import fs from "fs";
import { google, drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { LanguageConfig } from "../config/WordingConfig";

interface KeyLocation {
  sheetName: string;
  rowIndex: number;
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
    lines: { key: string; values: string[] }[]
  ) {
    const service = google.sheets({ version: "v4", auth: this.auth });
    const result = await service.spreadsheets.values.append({
      spreadsheetId,
      range: sheetName,
      valueInputOption: "RAW",
      requestBody: {
        values: lines.map(({ key, values }) => [key, ...values]),
      },
    });

    console.log(
      `${lines.length} line(s) appended (${result.data.updates?.updatedCells} cells).`
    );
    return result;
  }

  async updateLines(
    spreadsheetId: string,
    sheetNames: string[] | undefined,
    keyColumn: string,
    startRow: number,
    languages: LanguageConfig[],
    lines: { key: string; values: string[] }[]
  ) {
    const service = google.sheets({ version: "v4", auth: this.auth });
    const resolvedSheetNames = await this.resolveSheetNames(
      service,
      spreadsheetId,
      sheetNames
    );
    const keyLocations = await this.findKeyLocations(
      service,
      spreadsheetId,
      resolvedSheetNames,
      keyColumn,
      startRow
    );

    const updates: { range: string; values: string[][] }[] = [];
    for (const line of lines) {
      const location = keyLocations.get(line.key);
      if (!location) {
        throw new Error(`Key not found: "${line.key}"`);
      }

      languages.forEach((language, index) => {
        updates.push({
          range: `${location.sheetName}!${language.column}${location.rowIndex}`,
          values: [[line.values[index]]],
        });
      });
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

  private async resolveSheetNames(
    service: ReturnType<typeof google.sheets>,
    spreadsheetId: string,
    sheetNames: string[] | undefined
  ): Promise<string[]> {
    if (sheetNames && sheetNames.length > 0) {
      return sheetNames;
    }

    const meta = await service.spreadsheets.get({ spreadsheetId });
    const titles = meta.data.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title));

    if (!titles?.length) {
      throw new Error("No sheets found in spreadsheet");
    }

    return titles;
  }

  private async findKeyLocations(
    service: ReturnType<typeof google.sheets>,
    spreadsheetId: string,
    sheetNames: string[],
    keyColumn: string,
    startRow: number
  ): Promise<Map<string, KeyLocation>> {
    const keyLocations = new Map<string, KeyLocation>();

    for (const sheetName of sheetNames) {
      const response = await service.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!${keyColumn}${startRow}:${keyColumn}`,
      });

      const keys = response.data.values ?? [];
      keys.forEach((row, index) => {
        const key = row[0];
        if (!key) {
          return;
        }

        const location: KeyLocation = {
          sheetName,
          rowIndex: startRow + index,
        };

        const existing = keyLocations.get(key);
        if (existing) {
          throw new Error(
            `Duplicate key "${key}" found in sheets "${existing.sheetName}" and "${sheetName}"`
          );
        }

        keyLocations.set(key, location);
      });
    }

    return keyLocations;
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
