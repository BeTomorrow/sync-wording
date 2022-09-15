export interface Validation {
  column : string;
  expected: string;
}
export class LanguageConfig {
  name: string;
  column: string;
  output: string;
  validation : Validation | null

  constructor(name: string, config: any, defaultOutputDir: string, validation : Validation | null) {
    this.name = name;
    this.column = config.column;
    if (config.output) {
      this.output = config.output;
    } else {
      this.output = this.defaultOuput(defaultOutputDir, name);
    }
    this.validation = config.validation || validation;
  }

  private defaultOuput(defaultOutputDir: string, name: string) {
    if (defaultOutputDir.endsWith("/")) {
      return `${defaultOutputDir}${name}.json`;
    } else {
      return `${defaultOutputDir}/${name}.json`;
    }
  }
}

export class WordingConfig {
  wording_file: string;
  credentials: string;
  sheetId: string;
  sheetNames: string[];
  sheetStartIndex: number;
  keyColumn: string;
  output_dir: string;
  languages: LanguageConfig[];
  format: string;
  ignoreEmptyKeys: boolean;
  validation : Validation | null;

  constructor(jsonConfig: any) {
    this.wording_file = this.getOrDefault(
      jsonConfig,
      "wording_file",
      "./wording.xlsx"
    );

    this.credentials = this.getOrDefault(jsonConfig, "credentials", "");

    this.sheetId = jsonConfig.sheetId;
    this.sheetNames = jsonConfig.sheetNames;

    this.sheetStartIndex = this.getOrDefault(jsonConfig, "sheetStartIndex", 2);

    this.keyColumn = this.getOrDefault(jsonConfig, "keyColumn", "A");

    this.output_dir = this.getOrDefault(
      jsonConfig,
      "output_dir",
      "./src/assets/strings/"
    );

    this.languages = [];

    this.format = this.getOrDefault(jsonConfig, "format", "json");

    this.ignoreEmptyKeys = this.getOrDefault(jsonConfig, "ignoreEmptyKeys", false);

    this.validation = this.getOrDefault(jsonConfig, "validation", null)

    for (const language in jsonConfig.languages) {
      if (jsonConfig.languages.hasOwnProperty(language)) {
        const element = jsonConfig.languages[language];
        this.languages.push(
          new LanguageConfig(language, element, this.output_dir, this.validation)
        );
      }
    }

  }

  private getOrDefault<T>(source: any, key: string, defaultValue: T): T {
    if (source.hasOwnProperty(key)) {
      return source[key] as T;
    }
    return defaultValue;
  }
}
