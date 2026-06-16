import { ConfigError } from "../errors";

export interface Validation {
  column: string;
  expected: string;
}
export class LanguageConfig {
  name: string;
  column: string;
  output: string;
  validation: Validation | null;

  constructor(
    name: string,
    config: any,
    defaultOutputDir: string,
    validation: Validation | null,
  ) {
    this.name = name;
    this.column = config.column;
    if (!this.column) {
      throw new ConfigError(`Language "${name}" has no "column" defined`);
    }
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

/**
 * Reads `key` from the first source that defines it, so a target value
 * overrides a document-level value, which overrides the built-in default.
 */
function getOrDefault<T>(sources: any[], key: string, defaultValue: T): T {
  for (const source of sources) {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key] as T;
    }
  }
  return defaultValue;
}

export class TargetConfig {
  name: string;
  sheetNames: string[] | undefined;
  sheetStartIndex: number;
  keyColumn: string;
  output_dir: string;
  format: string;
  ignoreEmptyKeys: boolean;
  validation: Validation | null;
  languages: LanguageConfig[];

  constructor(name: string, targetJson: any, documentJson: any) {
    const sources = [targetJson, documentJson];

    this.name = name;
    this.sheetNames = getOrDefault<string[] | undefined>(
      sources,
      "sheetNames",
      undefined,
    );
    this.sheetStartIndex = getOrDefault(sources, "sheetStartIndex", 2);
    this.keyColumn = getOrDefault(sources, "keyColumn", "A");
    this.output_dir = getOrDefault(
      sources,
      "output_dir",
      "./src/assets/strings/",
    );
    this.format = getOrDefault(sources, "format", "json");
    this.ignoreEmptyKeys = getOrDefault(sources, "ignoreEmptyKeys", false);
    this.validation = getOrDefault<Validation | null>(
      sources,
      "validation",
      null,
    );

    const languagesJson = getOrDefault<any>(sources, "languages", null);
    if (!languagesJson || Object.keys(languagesJson).length === 0) {
      throw new ConfigError(`Target "${name}" has no "languages" defined`);
    }

    this.languages = [];
    for (const language in languagesJson) {
      if (languagesJson.hasOwnProperty(language)) {
        this.languages.push(
          new LanguageConfig(
            language,
            languagesJson[language],
            this.output_dir,
            this.validation,
          ),
        );
      }
    }
  }
}

export class WordingConfig {
  wording_file: string;
  credentials: string;
  sheetId: string;
  targets: TargetConfig[];

  constructor(jsonConfig: any) {
    this.wording_file = getOrDefault(
      [jsonConfig],
      "wording_file",
      "./wording.xlsx",
    );
    this.credentials = getOrDefault([jsonConfig], "credentials", "");
    this.sheetId = jsonConfig.sheetId;
    if (!this.sheetId) {
      throw new ConfigError(`"sheetId" is required`);
    }

    if (jsonConfig.targets) {
      const names = Object.keys(jsonConfig.targets);
      if (names.length === 0) {
        throw new ConfigError(`"targets" is defined but empty`);
      }
      this.targets = names.map(
        (name) => new TargetConfig(name, jsonConfig.targets[name], jsonConfig),
      );
    } else {
      // Flat configuration (legacy shape): a single implicit target.
      this.targets = [new TargetConfig("default", jsonConfig, {})];
    }
  }

  selectTargets(name: string | undefined): TargetConfig[] {
    if (!name) {
      return this.targets;
    }
    const target = this.targets.find((t) => t.name === name);
    if (!target) {
      const available = this.targets.map((t) => t.name).join(", ");
      throw new ConfigError(
        `Unknown target "${name}". Available targets: ${available}`,
      );
    }
    return [target];
  }

  hasMultipleTargets(): boolean {
    return this.targets.length > 1;
  }
}
