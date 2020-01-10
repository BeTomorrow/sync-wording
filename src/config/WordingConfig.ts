export class LanguageConfig {
  column: string;
  output: string;

  constructor(name: string, config: any, defaultOutputDir: string) {
    this.column = config.column;
    if (config.output) {
      this.output = config.output;
    } else {
      this.output = this.defaultOuput(defaultOutputDir, name);
    }
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

  constructor(jsonConfig: any) {
    this.wording_file = this.getOrDefault(
      jsonConfig,
      "wording_file",
      "./wording.xlsx"
    );

    this.credentials = this.getOrDefault(
      jsonConfig,
      "credentials",
      "./.google_credentials.json"
    );

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

    for (const language in jsonConfig.languages) {
      if (jsonConfig.languages.hasOwnProperty(language)) {
        const element = jsonConfig.languages[language];
        this.languages.push(
          new LanguageConfig(language, element, this.output_dir)
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
