export const EXIT_CODES = {
  OK: 0,
  INVALID_WORDINGS: 1,
  CONFIG_ERROR: 2,
  AUTH_ERROR: 3,
  UNEXPECTED_ERROR: 10,
} as const;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class AuthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthRequiredError";
  }
}
