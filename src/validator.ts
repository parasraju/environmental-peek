import type { EnvEntry } from "./types.js";

export interface ValidationIssue {
  key: string;
  line: number;
  type: "error" | "warning";
  message: string;
  rule: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  totalIssues: number;
}

export interface ValidateOptions {
  strict?: boolean;
}

const PLACEHOLDER_PATTERNS = [
  /<your-.*>/i,
  /your_.*_here/i,
  /CHANGEME/i,
  /TODO/i,
  /FIXME/i,
  /INSERT_.*_HERE/i,
  /YOUR_.*_HERE/i,
  /^xxx+$/i,
];

function isPlaceholder(value: string): boolean {
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(value)) return true;
  }
  return false;
}

export function validateEnv(entries: EnvEntry[], options: ValidateOptions = {}): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const strict = Boolean(options.strict);

  for (const entry of entries) {
    const { key, value, line, empty } = entry;
    const lowerKey = key.toLowerCase();
    const lowerVal = value.toLowerCase();

    // 1. Placeholder detection
    if (!empty && isPlaceholder(value)) {
      const issue: ValidationIssue = {
        key,
        line,
        type: strict ? "error" : "warning",
        message: `Value appears to be an unconfigured placeholder: "${value}"`,
        rule: "no-placeholders",
      };
      if (strict) errors.push(issue);
      else warnings.push(issue);
    }

    // 2. Port validation
    if (lowerKey === "port" || lowerKey.endsWith("_port")) {
      if (!empty) {
        const portNum = Number(value);
        if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
          errors.push({
            key,
            line,
            type: "error",
            message: `Port must be an integer between 1 and 65535, received "${value}"`,
            rule: "valid-port",
          });
        }
      }
    }

    // 3. Boolean flag validation
    if (
      lowerKey === "debug" ||
      lowerKey.startsWith("enable_") ||
      lowerKey.startsWith("disable_") ||
      lowerKey.startsWith("is_")
    ) {
      if (!empty) {
        const validBooleans = ["true", "false", "1", "0", "yes", "no"];
        if (!validBooleans.includes(lowerVal)) {
          warnings.push({
            key,
            line,
            type: "warning",
            message: `Expected boolean (true/false/1/0), received "${value}"`,
            rule: "valid-boolean",
          });
        }
      }
    }

    // 4. URL / URI validation
    if (lowerKey.endsWith("_url") || lowerKey.endsWith("_uri") || lowerKey === "database_url") {
      if (!empty && !isPlaceholder(value)) {
        const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
        if (!hasProtocol) {
          errors.push({
            key,
            line,
            type: "error",
            message: `Invalid URL/URI schema, missing protocol (e.g. https://, postgres://): "${value}"`,
            rule: "valid-url",
          });
        }
      }
    }

    // 5. Empty sensitive key check
    if (empty && entry.sensitive) {
      warnings.push({
        key,
        line,
        type: "warning",
        message: `Sensitive variable is empty`,
        rule: "no-empty-secrets",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalIssues: errors.length + warnings.length,
  };
}

function colorize(text: string, color: string, useColor: boolean): string {
  if (!useColor) return text;
  const codes: Record<string, string> = {
    dim: "\x1b[2m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    reset: "\x1b[0m",
  };
  return (codes[color] || "") + text + codes.reset;
}

export function formatValidation(result: ValidationResult, file: string, opts: { noColor?: boolean } = {}): string {
  const useColor = !opts.noColor && process.env.NO_COLOR === undefined;
  const lines: string[] = [];

  lines.push(colorize("envpeek check", "bold", useColor));
  lines.push("");
  lines.push(colorize(`File: ${file}`, "dim", useColor));
  lines.push(colorize("─".repeat(40), "dim", useColor));
  lines.push("");

  if (result.totalIssues === 0) {
    lines.push(colorize("✓ No validation issues found. Environment looks great!", "green", useColor));
  } else {
    for (const err of result.errors) {
      const lineTag = colorize(`line ${err.line}:`, "dim", useColor);
      const icon = colorize("✗", "red", useColor);
      const keyStr = colorize(err.key, "bold", useColor);
      lines.push(`${icon} ${lineTag} ${keyStr} - ${err.message} [${err.rule}]`);
    }

    for (const warn of result.warnings) {
      const lineTag = colorize(`line ${warn.line}:`, "dim", useColor);
      const icon = colorize("⚠", "yellow", useColor);
      const keyStr = colorize(warn.key, "bold", useColor);
      lines.push(`${icon} ${lineTag} ${keyStr} - ${warn.message} [${warn.rule}]`);
    }
  }

  lines.push("");
  lines.push(colorize("─".repeat(40), "dim", useColor));
  const summaryText = `${result.errors.length} error${result.errors.length !== 1 ? "s" : ""}, ${result.warnings.length} warning${result.warnings.length !== 1 ? "s" : ""}`;
  lines.push(colorize(summaryText, result.valid ? "green" : "red", useColor));

  return lines.join("\n");
}
