import fs from "fs";
import { google, drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { LanguageConfig } from "../config/WordingConfig";
import { ConfigError } from "../errors";

export interface SheetWriteConfig {
  keyColumn: string;
  languages: LanguageConfig[];
  sheetStartIndex: number;
}

export interface KeyLocation {
  sheetName: string;
  rowIndex: number;
}

/**
 * Lazy ambiguity resolution: duplicate keys across sheets are legal for
 * reading (last sheet wins at sync time), so they only fail --set when the
 * duplicated key is the one being updated — never while updating another key.
 */
export function pickKeyLocation(
  key: string,
  locations: KeyLocation[] | undefined,
  searchedSheets: string[]
): KeyLocation {
  if (!locations || locations.length === 0) {
    throw new ConfigError(
      `Key not found: "${key}" (searched sheets: ${searchedSheets.join(", ")})`
    );
  }
  if (locations.length > 1) {
    const sheets = [...new Set(locations.map((l) => l.sheetName))];
    if (sheets.length > 1) {
      throw new ConfigError(
        `Ambiguous key "${key}": found in sheets ${sheets.join(", ")}. ` +
          `Pass --sheet-name <name> to pick one`
      );
    }
    throw new ConfigError(
      `Duplicate key "${key}": found ${locations.length} times in sheet "${sheets[0]}". ` +
        `Fix the duplicate rows in the spreadsheet first`
    );
  }
  return locations[0];
}

export class Drive {
  drive: drive_v3.Drive;

  constructor(private readonly auth: OAuth2Client) {
    this.drive = google.drive({ version: "v3", auth });
  }

  async addLines(
    spreadsheetId: string,
    sheetName: string,
    lines: { key: string; values: string[] }[],
    writeConfig: SheetWriteConfig
  ) {
    const service = google.sheets({ version: "v4", auth: this.auth });

    // Anchor the write on keyColumn / sheetStartIndex — the same row model as
    // reads, --set and --remove. We do NOT use values.append: it auto-detects a
    // "table" from the range and writes from that table's first column, which
    // misaligns the row when keyColumn is not the sheet's first column, and it
    // ignores sheetStartIndex. Writing each cell at its explicit address also
    // leaves untouched any column between the configured ones.
    const firstFreeRow = await this.findFirstFreeRow(
      service,
      spreadsheetId,
      sheetName,
      writeConfig.keyColumn,
      writeConfig.sheetStartIndex
    );

    const updates: { range: string; values: string[][] }[] = [];
    lines.forEach((line, index) => {
      updates.push(
        ...this.buildLineUpdates(
          sheetName,
          firstFreeRow + index,
          line,
          writeConfig
        )
      );
    });

    const result = await service.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    });

    console.log(
      `${lines.length} line(s) appended (${result.data.totalUpdatedCells} cells).`
    );
    return result;
  }

  /**
   * First writable row: the row right after the last non-empty cell in the key
   * column, starting at sheetStartIndex. values.get trims trailing blank rows,
   * so its row count is exactly the number of used rows from startRow.
   */
  private async findFirstFreeRow(
    service: ReturnType<typeof google.sheets>,
    spreadsheetId: string,
    sheetName: string,
    keyColumn: string,
    startRow: number
  ): Promise<number> {
    const response = await service.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${keyColumn}${startRow}:${keyColumn}`,
    });
    const usedRows = response.data.values?.length ?? 0;
    return startRow + usedRows;
  }

  private buildLineUpdates(
    sheetName: string,
    rowIndex: number,
    line: { key: string; values: string[] },
    writeConfig: SheetWriteConfig
  ): { range: string; values: string[][] }[] {
    return [
      {
        range: `${sheetName}!${writeConfig.keyColumn}${rowIndex}`,
        values: [[line.key]],
      },
      ...this.buildTranslationUpdates(sheetName, rowIndex, line, writeConfig),
    ];
  }

  async updateLines(
    spreadsheetId: string,
    sheetNames: string[] | undefined,
    lines: { key: string; values: string[] }[],
    writeConfig: SheetWriteConfig
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
      writeConfig.keyColumn,
      writeConfig.sheetStartIndex
    );

    const updates: { range: string; values: string[][] }[] = [];
    for (const line of lines) {
      const location = pickKeyLocation(
        line.key,
        keyLocations.get(line.key),
        resolvedSheetNames
      );

      updates.push(
        ...this.buildTranslationUpdates(
          location.sheetName,
          location.rowIndex,
          line,
          writeConfig
        )
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

  async removeLines(
    spreadsheetId: string,
    sheetNames: string[] | undefined,
    keys: string[],
    writeConfig: SheetWriteConfig
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
      writeConfig.keyColumn,
      writeConfig.sheetStartIndex
    );

    const uniqueKeys = [...new Set(keys)];
    const locations = uniqueKeys.map((key) =>
      pickKeyLocation(key, keyLocations.get(key), resolvedSheetNames)
    );

    // DeleteDimension requires the numeric sheet id, not its title.
    const meta = await service.spreadsheets.get({ spreadsheetId });
    const sheetIdsByTitle = new Map<string, number>();
    meta.data.sheets?.forEach((sheet) => {
      const title = sheet.properties?.title;
      const sheetId = sheet.properties?.sheetId;
      if (title != null && sheetId != null) {
        sheetIdsByTitle.set(title, sheetId);
      }
    });

    // Delete bottom-up so earlier deletions don't shift the next row indexes.
    const requests = locations
      .sort((a, b) => b.rowIndex - a.rowIndex)
      .map((location) => {
        const sheetId = sheetIdsByTitle.get(location.sheetName);
        if (sheetId === undefined) {
          throw new ConfigError(
            `Sheet "${location.sheetName}" not found in spreadsheet`
          );
        }
        return {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: location.rowIndex - 1,
              endIndex: location.rowIndex,
            },
          },
        };
      });

    const result = await service.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });

    console.log(`${uniqueKeys.length} line(s) removed.`);
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
  ): Promise<Map<string, KeyLocation[]>> {
    const keyLocations = new Map<string, KeyLocation[]>();

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

        const locations = keyLocations.get(key) ?? [];
        locations.push({ sheetName, rowIndex: startRow + index });
        keyLocations.set(key, locations);
      });
    }

    return keyLocations;
  }

  async exportAsXlsx(fileId: string, output: string, mimeType: string) {
    try {
      const res = await this.drive.files.export(
        {
          fileId,
          mimeType
        },
        { responseType: "stream" }
      );
      const dest = fs.createWriteStream(output);
      await new Promise((resolve, reject) => {
        (res.data as any)
          .on("error", reject)
          .pipe(dest)
          .on("error", reject)
          .on("finish", resolve);
      });
    } catch (error) {
      // Don't leave a partial/empty xlsx behind: a later --update would
      // silently read it as an empty workbook.
      fs.rmSync(output, { force: true });
      throw error;
    }
  }
}
