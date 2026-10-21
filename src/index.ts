export { parseEnv } from "./parser.js";
export { maskValue, detectSecret } from "./masker.js";
export {
  calculateEntropy,
  isHighEntropy,
  detectSecretByValue,
  TOKEN_PATTERNS,
  AWS_PATTERN,
  GITHUB_PATTERN,
  STRIPE_PATTERN,
  SLACK_PATTERN,
  OPENAI_PATTERN,
  JWT_PATTERN,
  PRIVATE_KEY_PATTERN,
  type ValueDetectionResult,
} from "./secret-patterns.js";
export { formatTable, formatJson, getSummary, formatValue } from "./formatter.js";
export { diffEnvs, formatDiff, formatDiffJson } from "./diff.js";
export { resolveEnvFile, readEnvFile, readFromStdin } from "./scanner.js";
export { filterEntries, type FilterOptions } from "./filter.js";
export {
  validateEnv,
  formatValidation,
  type ValidationIssue,
  type ValidationResult,
  type ValidateOptions,
} from "./validator.js";
export {
  generateExample,
  getPlaceholder,
  generatePlaceholder,
  type GenerateExampleOptions,
  type PlaceholderStyle,
  type ExampleOptions,
} from "./generator.js";
export type {
  EnvEntry,
  ParseResult,
  CliOptions,
  Summary,
  JsonOutput,
  EnvDiffResult,
  EnvDiffChange,
  EnvDiffSummary,
  DiffOptions,
} from "./types.js";
