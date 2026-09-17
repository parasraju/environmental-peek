import type { EnvEntry, Summary } from "./types.js";
import { maskValue } from "./masker.js";

export interface FormatOptions {
  show: boolean;
  raw: boolean;
  noColor: boolean;
  quiet: boolean;
}

export function getSummary(entries: EnvEntry[]): Summary {
  let sensitive = 0;
  let empty = 0;
  for (const e of entries) {
    if (e.sensitive) sensitive++;
    if (e.empty) empty++;
  }
  return {
    total: entries.length,
    sensitive,
    visible: entries.length - sensitive,
    empty,
  };
}

export function formatValue(entry: EnvEntry, opts: FormatOptions): string {
  if (entry.empty) return "<empty>";
  if (opts.show || opts.raw) return entry.value;
  if (entry.sensitive) return maskValue(entry.value, entry.key);
  return entry.value;
}

// Minimal color helpers without deps
function shouldUseColor(noColor: boolean): boolean {
  if (noColor) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  // Check if stdout is TTY
  if (process.stdout && process.stdout.isTTY === false) return false;
  return true;
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
    gray: "\x1b[90m",
    reset: "\x1b[0m",
  };
  const c = codes[color] || "";
  return c + text + codes.reset;
}

export function formatTable(entries: EnvEntry[], file: string, opts: FormatOptions): string {
  const useColor = shouldUseColor(opts.noColor);
  const lines: string[] = [];

  if (!opts.quiet) {
    lines.push(colorize("envpeek", "bold", useColor));
    lines.push("");
    lines.push(colorize(`Environment: ${file}`, "dim", useColor));
    lines.push(colorize("─".repeat(40), "dim", useColor));
    lines.push("");
  }

  if (entries.length === 0) {
    lines.push(colorize("  (no variables found)", "dim", useColor));
  } else {
    // Determine column width for keys
    let maxKeyLen = 0;
    for (const e of entries) {
      if (e.key.length > maxKeyLen) maxKeyLen = e.key.length;
    }
    maxKeyLen = Math.min(maxKeyLen, 30);
    const keyColWidth = Math.max(maxKeyLen + 2, 18);

    for (const e of entries) {
      const displayValue = formatValue(e, opts);
      const isMasked = !opts.show && !opts.raw && e.sensitive;
      const isEmpty = e.empty;

      let icon: string;
      if (isEmpty) icon = colorize("○", "gray", useColor);
      else if (isMasked) icon = colorize("✓", "yellow", useColor);
      else icon = colorize("✓", "green", useColor);

      // Lock indicator for sensitive
      const lock = e.sensitive ? colorize("🔒 ", "dim", useColor) : "  ";

      // Pad key
      const paddedKey = e.key.padEnd(keyColWidth, " ");

      let valueStr = displayValue;
      if (isEmpty) valueStr = colorize("<empty>", "dim", useColor);
      else if (isMasked) valueStr = colorize(displayValue, "yellow", useColor);
      else valueStr = colorize(displayValue, "cyan", useColor);

      // Truncate long values for display (unless show)
      if (!opts.show && !opts.raw && valueStr.length > 50) {
        // Keep color handling simple: truncate plain displayValue then re-color
        const truncated = displayValue.slice(0, 47) + "...";
        valueStr = e.sensitive ? colorize(truncated, "yellow", useColor) : colorize(truncated, "cyan", useColor);
      } else if ((opts.show || opts.raw) && displayValue.length > 80) {
        const truncated = displayValue.slice(0, 77) + "...";
        valueStr = colorize(truncated, "cyan", useColor);
      }

      // For sensitive multiline, show masked anyway
      lines.push(`${icon} ${lock}${paddedKey} ${valueStr}`);
    }
  }

  if (!opts.quiet) {
    lines.push("");
    lines.push(colorize("─".repeat(40), "dim", useColor));
    const summary = getSummary(entries);
    const summaryParts: string[] = [];
    summaryParts.push(`${summary.total} variable${summary.total !== 1 ? "s" : ""}`);
    if (summary.sensitive > 0) summaryParts.push(`${summary.sensitive} hidden`);
    summaryParts.push(`${summary.visible} visible`);
    if (summary.empty > 0) summaryParts.push(`${summary.empty} empty`);
    lines.push(colorize(summaryParts.join(" • "), "dim", useColor));
  }

  return lines.join("\n");
}

export function formatJson(entries: EnvEntry[], file: string, opts: FormatOptions): string {
  const obj = {
    file,
    variables: entries.map((e) => ({
      key: e.key,
      value: e.empty ? "" : opts.show || opts.raw ? e.value : e.sensitive ? maskValue(e.value, e.key) : e.value,
      sensitive: e.sensitive,
      empty: e.empty,
    })),
    summary: {
      total: entries.length,
      sensitive: entries.filter((e) => e.sensitive).length,
      empty: entries.filter((e) => e.empty).length,
    },
  };
  return JSON.stringify(obj, null, 2);
}
