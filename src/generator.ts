import { detectSecret } from "./masker.js";
import type {
  EnvEntry,
  ParseResult,
  PlaceholderStyle,
  GenerateExampleOptions,
} from "./types.js";

export type { PlaceholderStyle, GenerateExampleOptions };

/**
 * Returns a placeholder value for a sensitive key based on the requested style.
 * - bracket: <your-${key.toLowerCase()}>
 * - dummy: your-${key.toLowerCase()}
 * - empty: ""
 */
export function getPlaceholder(
  key: string,
  style: PlaceholderStyle = "bracket"
): string {
  const normalizedKey = key.toLowerCase();
  switch (style) {
    case "bracket":
      return `<your-${normalizedKey}>`;
    case "dummy":
      return `your_${normalizedKey}_here`;
    case "empty":
      return "";
    default:
      return `<your-${normalizedKey}>`;
  }
}

export const generatePlaceholder = getPlaceholder;
export type { GenerateExampleOptions as ExampleOptions };

/**
 * Generates a clean .env.example from raw .env file content or parsed entries.
 * Preserves comments, empty lines, formatting, and key structure.
 * Replaces secrets and sensitive keys with appropriate placeholders while
 * keeping non-sensitive defaults intact.
 */
export function generateExample(
  content: string | EnvEntry[] | ParseResult,
  options?: GenerateExampleOptions
): string {
  if (Array.isArray(content)) {
    return generateFromEntries(content, options);
  }

  if (
    content !== null &&
    typeof content === "object" &&
    "entries" in content &&
    Array.isArray((content as ParseResult).entries)
  ) {
    return generateFromEntries((content as ParseResult).entries, options);
  }

  if (typeof content === "string") {
    return generateFromString(content, options);
  }

  return "";
}

function generateFromEntries(
  entries: EnvEntry[],
  options?: GenerateExampleOptions
): string {
  const style = options?.placeholderStyle ?? "bracket";
  const preserveNonSensitive = options?.preserveNonSensitive ?? true;

  const lines = entries.map((entry) => {
    const isSensitive = entry.sensitive || detectSecret(entry.key);
    if (isSensitive) {
      const placeholder = getPlaceholder(entry.key, style);
      return `${entry.key}=${placeholder}`;
    }
    if (preserveNonSensitive) {
      return `${entry.key}=${entry.rawValue ?? entry.value}`;
    }
    const placeholder = getPlaceholder(entry.key, style);
    return `${entry.key}=${placeholder}`;
  });

  return lines.join("\n");
}

function generateFromString(
  content: string,
  options?: GenerateExampleOptions
): string {
  if (content === "") return "";

  const style = options?.placeholderStyle ?? "bracket";
  const preserveNonSensitive = options?.preserveNonSensitive ?? true;

  const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const resultLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Preserve comments and empty lines
    if (trimmed === "" || trimmed.startsWith("#")) {
      resultLines.push(rawLine);
      i++;
      continue;
    }

    const eqIndex = findEquals(rawLine);
    if (eqIndex === -1) {
      // Lines without '=' (malformed or invalid) are preserved as-is
      resultLines.push(rawLine);
      i++;
      continue;
    }

    const keyPart = rawLine.slice(0, eqIndex);
    const trimmedKeyPart = keyPart.trim();
    const actualKey = trimmedKeyPart.startsWith("export ")
      ? trimmedKeyPart.slice(7).trim()
      : trimmedKeyPart;

    if (!isValidKey(actualKey)) {
      resultLines.push(rawLine);
      i++;
      continue;
    }

    const valuePart = rawLine.slice(eqIndex + 1);
    const valueTrimmedStart = valuePart.trimStart();

    let isMultiline = false;
    let inlineComment = "";

    // Check for multiline quoted value or single-line quoted value
    if (valueTrimmedStart.startsWith('"') || valueTrimmedStart.startsWith("'")) {
      const quoteChar = valueTrimmedStart[0];
      const afterOpen = valueTrimmedStart.slice(1);
      const closeIdx = findClosingQuote(afterOpen, quoteChar);

      if (closeIdx === -1) {
        // Unterminated on this line: multiline string
        let accumulated = valuePart;
        let j = i + 1;
        let foundClose = false;

        while (j < lines.length) {
          accumulated += "\n" + lines[j];
          const fullTrimmed = accumulated.trimStart();
          const afterFirst = fullTrimmed.slice(1);
          const multiCloseIdx = findClosingQuote(afterFirst, quoteChar);

          if (multiCloseIdx !== -1) {
            foundClose = true;
            const closingLine = lines[j];
            const lastQuoteIdx = closingLine.lastIndexOf(quoteChar);
            if (lastQuoteIdx !== -1) {
              const afterQuote = closingLine.slice(lastQuoteIdx + 1);
              const cIdx = findInlineComment(afterQuote);
              if (cIdx !== -1) {
                inlineComment = afterQuote.slice(cIdx);
              }
            }
            break;
          }
          j++;
        }

        if (foundClose) {
          isMultiline = true;
          i = j; // advance outer index to closing line
        }
      } else {
        // Quoted on single line: check for inline comment after closing quote
        const afterClose = afterOpen.slice(closeIdx + 1);
        const cIdx = findInlineComment(afterClose);
        if (cIdx !== -1) {
          inlineComment = afterClose.slice(cIdx);
        }
      }
    } else {
      // Unquoted value: check for inline comment
      const cIdx = findInlineComment(valuePart);
      if (cIdx !== -1) {
        inlineComment = valuePart.slice(cIdx);
      }
    }

    const isSensitive = detectSecret(actualKey) || isMultiline;

    if (isSensitive) {
      const placeholder = getPlaceholder(actualKey, style);
      const comment = inlineComment
        ? inlineComment.startsWith(" ")
          ? inlineComment
          : " " + inlineComment
        : "";
      resultLines.push(`${keyPart}=${placeholder}${comment}`);
    } else if (preserveNonSensitive) {
      resultLines.push(rawLine);
    } else {
      const placeholder = getPlaceholder(actualKey, style);
      const comment = inlineComment
        ? inlineComment.startsWith(" ")
          ? inlineComment
          : " " + inlineComment
        : "";
      resultLines.push(`${keyPart}=${placeholder}${comment}`);
    }

    i++;
  }

  return resultLines.join(lineEnding);
}

function findEquals(line: string): number {
  return line.indexOf("=");
}

function isValidKey(key: string): boolean {
  if (key === "") return false;
  if (key.includes(" ") || key.includes("#") || key.includes("=")) {
    return false;
  }
  return /^[A-Za-z_][A-Za-z0-9_\.]*$/.test(key);
}

function findClosingQuote(content: string, quote: string): number {
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
      return idx;
    }
  }
  return -1;
}

function findInlineComment(value: string): number {
  for (let ci = 0; ci < value.length; ci++) {
    if (value[ci] === "#") {
      if (ci === 0) return 0;
      const prev = value[ci - 1];
      if (prev === " " || prev === "\t") {
        return ci;
      }
    }
  }
  return -1;
}
