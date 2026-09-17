import { detectSecret } from "./masker.js";
import type { EnvEntry, ParseResult } from "./types.js";

export function parseEnv(content: string): ParseResult {
  const entries: EnvEntry[] = [];
  const warnings: string[] = [];
  const seenKeys = new Map<string, number>();

  const lines = splitLines(content);
  let i = 0;
  let lineNumber = 0;

  while (i < lines.length) {
    lineNumber = i + 1;
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip empty lines and comments
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    // Handle multiline quoted values: detect opening quote without closing
    // We need to check if line contains = and value starts with " or ' and not closed
    const eqIndex = findEquals(rawLine);
    if (eqIndex === -1) {
      warnings.push(`Skipping invalid line ${lineNumber}: no '=' found`);
      i++;
      continue;
    }

    const keyPart = rawLine.slice(0, eqIndex).trim();
    let valuePart = rawLine.slice(eqIndex + 1);

    // Validate key
    if (!isValidKey(keyPart)) {
      warnings.push(`Skipping invalid key at line ${lineNumber}: "${keyPart}"`);
      i++;
      continue;
    }

    // Check for multiline: value starts with " and not closed on same line
    const valueTrimmedStart = valuePart.trimStart();
    let quoteChar: string | null = null;
    if (valueTrimmedStart.startsWith('"') || valueTrimmedStart.startsWith("'")) {
      quoteChar = valueTrimmedStart[0];
      // Count if value is closed on same line (respecting escapes handled later)
      const afterOpen = valueTrimmedStart.slice(1);
      const closed = isQuoteClosed(afterOpen, quoteChar);
      if (!closed) {
        // Multiline: accumulate lines until closing quote
        let accumulated = valuePart;
        let j = i + 1;
        let foundClose = false;
        while (j < lines.length) {
          accumulated += "\n" + lines[j];
          // check if lines[j] contains closing quote
          // We check if the accumulated value (from first quote) has closing quote
          const fullValueTrimmed = accumulated.trimStart();
          // Extract content after first quote
          const afterFirstQuote = fullValueTrimmed.slice(1);
          if (isQuoteClosed(afterFirstQuote, quoteChar)) {
            foundClose = true;
            break;
          }
          j++;
        }
        if (foundClose) {
          valuePart = accumulated;
          i = j; // will increment at end
        } else {
          warnings.push(`Unterminated quoted value at line ${lineNumber}`);
          // treat as is
        }
      }
    }

    // Now parse value
    const parsedValue = parseValue(valuePart);

    const sensitive = detectSecret(keyPart);
    // Also treat multiline as sensitive regardless of name
    const isMultiline = parsedValue.includes("\n");
    const finalSensitive = sensitive || isMultiline;

    const empty = parsedValue === "";

    if (seenKeys.has(keyPart)) {
      warnings.push(`Duplicate key "${keyPart}" at line ${lineNumber} (previous at line ${seenKeys.get(keyPart)})`);
    }
    seenKeys.set(keyPart, lineNumber);

    entries.push({
      key: keyPart,
      value: parsedValue,
      rawValue: valuePart,
      sensitive: finalSensitive,
      empty,
      line: lineNumber,
    });

    i++;
  }

  return { entries, warnings };
}

function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

function findEquals(line: string): number {
  // Find first =, but not inside? For env files, first = is delimiter
  return line.indexOf("=");
}

function isValidKey(key: string): boolean {
  if (key === "") return false;
  // Keys typically: [A-Za-z_][A-Za-z0-9_.]* but allow more permissive?
  // We'll be permissive but not allow spaces or # or = inside
  if (key.includes(" ") || key.includes("#") || key.includes("=")) {
    // But spec allows "PORT = 3000" -> keyPart trimmed, so spaces removed. So key shouldn't contain spaces after trim.
    return false;
  }
  // Allow alphanumeric, underscore, dot
  return /^[A-Za-z_][A-Za-z0-9_\.]*$/.test(key);
}

function isQuoteClosed(content: string, quote: string): boolean {
  // Check if quote is closed, handling escapes for double quotes
  let escaped = false;
  for (let idx = 0; idx < content.length; idx++) {
    const ch = content[idx];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === '"' && ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === quote) {
      // For single quotes, no escaping (but handle)
      // Look ahead: if there's more content after closing quote, we still consider closed
      // We consider closed if we find a matching quote
      return true;
    }
  }
  return false;
}

function parseValue(raw: string): string {
  let value = raw.trim();

  if (value === "") return "";

  // Check for quoted string (single or double)
  if ((value.startsWith('"') && value.endsWith('"') && value.length >= 2) || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)) {
    // Check if it's multiline quoted: starts and ends with same quote but contains newline
    const quote = value[0];
    let inner = value.slice(1, -1);
    // Handle multiline: inner may contain newlines already
    if (quote === '"') {
      inner = unescapeDoubleQuoted(inner);
    }
    // For single quotes, no escaping (preserve as-is)
    return inner;
  }

  // Handle case where value starts with quote but we already handled multiline accumulation above
  // If value is something like "\"hello world\" # comment" -> need to extract quoted part
  if (value.startsWith('"') || value.startsWith("'")) {
    const quote = value[0];
    // Find closing quote
    let endIdx = -1;
    let escaped = false;
    for (let ci = 1; ci < value.length; ci++) {
      const ch = value[ci];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (quote === '"' && ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        endIdx = ci;
        break;
      }
    }
    if (endIdx !== -1) {
      let inner = value.slice(1, endIdx);
      if (quote === '"') inner = unescapeDoubleQuoted(inner);
      // Ignore anything after closing quote (including inline comments)
      return inner;
    }
    // Unterminated - strip opening quote and return rest
    let inner = value.slice(1);
    if (quote === '"') inner = unescapeDoubleQuoted(inner);
    return inner;
  }

  // Unquoted value: strip inline comment
  // Find # that is preceded by space (common dotenv behavior)
  // We use simple: if there's " #", treat as comment start
  const commentIndex = findInlineComment(value);
  if (commentIndex !== -1) {
    value = value.slice(0, commentIndex).trimEnd();
  }

  return value;
}

function findInlineComment(value: string): number {
  // Only treat # as comment if preceded by whitespace and not inside value?
  // For unquoted values, # starts comment if preceded by space or at start
  // We look for " #" pattern
  for (let ci = 0; ci < value.length; ci++) {
    if (value[ci] === "#") {
      if (ci === 0) return 0;
      const prev = value[ci - 1];
      if (prev === " " || prev === "\t") {
        // Ensure not part of value like "abc#def" -> not comment (no space)
        return ci;
      }
    }
  }
  return -1;
}

function unescapeDoubleQuoted(s: string): string {
  // Handle common escapes: \n, \r, \t, \", \\, \', \`
  // Also handle actual newlines preserved in multiline
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
}
