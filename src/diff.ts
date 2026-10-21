import type { EnvEntry, ParseResult } from "./types.js";
import { maskValue, detectSecret } from "./masker.js";
import { parseEnv } from "./parser.js";

export interface EnvDiffChange {
  key: string;
  baseValue: string;
  targetValue: string;
  sensitive: boolean;
}

export interface EnvDiffSummary {
  missing: number;
  extra: number;
  changed: number;
  identical: number;
  total: number;
}

export interface EnvDiffResult {
  missing: EnvEntry[];
  extra: EnvEntry[];
  changed: EnvDiffChange[];
  identical: EnvEntry[];
  summary: EnvDiffSummary;
  hasDifferences: boolean;
}

export interface DiffOptions {
  noColor?: boolean;
  show?: boolean;
  raw?: boolean;
  quiet?: boolean;
}

function normalizeEntries(input: EnvEntry[] | ParseResult | string): EnvEntry[] {
  if (typeof input === "string") {
    return parseEnv(input).entries;
  }
  if (Array.isArray(input)) {
    return input;
  }
  if (input && Array.isArray((input as ParseResult).entries)) {
    return (input as ParseResult).entries;
  }
  return [];
}

export function diffEnvs(
  base: EnvEntry[] | ParseResult | string,
  target: EnvEntry[] | ParseResult | string
): EnvDiffResult {
  const baseEntries = normalizeEntries(base);
  const targetEntries = normalizeEntries(target);

  const baseMap = new Map<string, EnvEntry>();
  for (const entry of baseEntries) {
    baseMap.set(entry.key, entry);
  }

  const targetMap = new Map<string, EnvEntry>();
  for (const entry of targetEntries) {
    targetMap.set(entry.key, entry);
  }

  const missing: EnvEntry[] = [];
  const identical: EnvEntry[] = [];
  const changed: EnvDiffChange[] = [];
  const extra: EnvEntry[] = [];

  const visitedBase = new Set<string>();
  for (const entry of baseEntries) {
    const key = entry.key;
    if (visitedBase.has(key)) continue;
    visitedBase.add(key);

    const baseEntry = baseMap.get(key)!;
    const targetEntry = targetMap.get(key);

    if (!targetEntry) {
      missing.push({
        ...baseEntry,
        sensitive: baseEntry.sensitive || detectSecret(key, baseEntry.value),
      });
    } else if (baseEntry.value === targetEntry.value) {
      identical.push({
        ...targetEntry,
        sensitive: targetEntry.sensitive || baseEntry.sensitive || detectSecret(key, targetEntry.value),
      });
    } else {
      const sensitive = Boolean(
        baseEntry.sensitive || targetEntry.sensitive || detectSecret(key, baseEntry.value) || detectSecret(key, targetEntry.value)
      );
      changed.push({
        key,
        baseValue: baseEntry.value,
        targetValue: targetEntry.value,
        sensitive,
      });
    }
  }

  const visitedTarget = new Set<string>();
  for (const entry of targetEntries) {
    const key = entry.key;
    if (visitedTarget.has(key)) continue;
    visitedTarget.add(key);

    if (!baseMap.has(key)) {
      const targetEntry = targetMap.get(key)!;
      extra.push({
        ...targetEntry,
        sensitive: targetEntry.sensitive || detectSecret(key, targetEntry.value),
      });
    }
  }

  const summary: EnvDiffSummary = {
    missing: missing.length,
    extra: extra.length,
    changed: changed.length,
    identical: identical.length,
    total: missing.length + extra.length + changed.length + identical.length,
  };

  const hasDifferences = missing.length > 0 || extra.length > 0 || changed.length > 0;

  return {
    missing,
    extra,
    changed,
    identical,
    summary,
    hasDifferences,
  };
}

function shouldUseColor(noColor?: boolean): boolean {
  if (noColor === true) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  if (noColor === false) return true;
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
    reset: "\x1b[0m",
  };
  return (codes[color] || "") + text + codes.reset;
}

function formatValueForDiff(
  value: string,
  sensitive: boolean,
  key: string,
  show: boolean
): string {
  if (value === "") return "<empty>";
  if (show) {
    return value.includes("\n") ? value.replace(/\r?\n/g, "\\n") : value;
  }
  if (sensitive) {
    return maskValue(value, key);
  }
  return value.includes("\n") ? value.replace(/\r?\n/g, "\\n") : value;
}

export function formatDiff(
  diff: EnvDiffResult,
  baseName: string = ".env.example",
  targetName: string = ".env",
  opts?: DiffOptions
): string {
  const useColor = shouldUseColor(opts?.noColor);
  const show = Boolean(opts?.show || opts?.raw);
  const lines: string[] = [];

  if (!opts?.quiet) {
    lines.push(colorize("envpeek diff", "bold", useColor));
    lines.push("");
    lines.push(colorize(`Base:   ${baseName}`, "dim", useColor));
    lines.push(colorize(`Target: ${targetName}`, "dim", useColor));
    lines.push(colorize("─".repeat(40), "dim", useColor));
    lines.push("");
  }

  const hasAny =
    diff.missing.length > 0 ||
    diff.extra.length > 0 ||
    diff.changed.length > 0 ||
    diff.identical.length > 0;

  if (!hasAny) {
    lines.push(colorize("  (no variables found)", "dim", useColor));
  } else {
    // Missing variables
    if (diff.missing.length > 0) {
      lines.push(colorize(`Missing in ${targetName} (${diff.missing.length}):`, "red", useColor));
      for (const entry of diff.missing) {
        const val = formatValueForDiff(entry.value, entry.sensitive, entry.key, show);
        const prefix = colorize("-", "red", useColor);
        const lock = entry.sensitive ? colorize("🔒 ", "dim", useColor) : "  ";
        const keyStr = colorize(entry.key, "bold", useColor);
        lines.push(`  ${prefix} ${lock}${keyStr}: ${val}`);
      }
      lines.push("");
    }

    // Extra variables
    if (diff.extra.length > 0) {
      lines.push(colorize(`Extra in ${targetName} (${diff.extra.length}):`, "cyan", useColor));
      for (const entry of diff.extra) {
        const val = formatValueForDiff(entry.value, entry.sensitive, entry.key, show);
        const prefix = colorize("+", "cyan", useColor);
        const lock = entry.sensitive ? colorize("🔒 ", "dim", useColor) : "  ";
        const keyStr = colorize(entry.key, "bold", useColor);
        lines.push(`  ${prefix} ${lock}${keyStr}: ${val}`);
      }
      lines.push("");
    }

    // Changed variables
    if (diff.changed.length > 0) {
      lines.push(colorize(`Changed (${diff.changed.length}):`, "yellow", useColor));
      for (const ch of diff.changed) {
        const baseVal = formatValueForDiff(ch.baseValue, ch.sensitive, ch.key, show);
        const targetVal = formatValueForDiff(ch.targetValue, ch.sensitive, ch.key, show);
        const prefix = colorize("~", "yellow", useColor);
        const lock = ch.sensitive ? colorize("🔒 ", "dim", useColor) : "  ";
        const keyStr = colorize(ch.key, "bold", useColor);
        lines.push(`  ${prefix} ${lock}${keyStr}: ${baseVal} -> ${targetVal}`);
      }
      lines.push("");
    }

    // Identical variables
    if (diff.identical.length > 0) {
      lines.push(colorize(`Identical (${diff.identical.length}):`, "dim", useColor));
      for (const entry of diff.identical) {
        const val = formatValueForDiff(entry.value, entry.sensitive, entry.key, show);
        const prefix = colorize("=", "dim", useColor);
        const lock = entry.sensitive ? colorize("🔒 ", "dim", useColor) : "  ";
        const keyStr = colorize(entry.key, "dim", useColor);
        lines.push(`  ${prefix} ${lock}${keyStr}: ${val}`);
      }
      lines.push("");
    }

    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }
  }

  if (!opts?.quiet) {
    lines.push("");
    lines.push(colorize("─".repeat(40), "dim", useColor));
    const summaryParts: string[] = [];
    if (diff.missing.length > 0) summaryParts.push(`${diff.missing.length} missing`);
    if (diff.extra.length > 0) summaryParts.push(`${diff.extra.length} extra`);
    if (diff.changed.length > 0) summaryParts.push(`${diff.changed.length} changed`);
    if (diff.identical.length > 0) summaryParts.push(`${diff.identical.length} identical`);
    if (summaryParts.length === 0) summaryParts.push("0 variables");
    lines.push(colorize(summaryParts.join(" • "), "dim", useColor));
  }

  return lines.join("\n");
}

export function formatDiffJson(
  diff: EnvDiffResult,
  baseName: string = ".env.example",
  targetName: string = ".env",
  opts?: DiffOptions
): string {
  const show = Boolean(opts?.show || opts?.raw);
  const data = {
    baseFile: baseName,
    targetFile: targetName,
    missing: diff.missing.map((e) => ({
      key: e.key,
      value: formatValueForDiff(e.value, e.sensitive, e.key, show),
      sensitive: e.sensitive,
    })),
    extra: diff.extra.map((e) => ({
      key: e.key,
      value: formatValueForDiff(e.value, e.sensitive, e.key, show),
      sensitive: e.sensitive,
    })),
    changed: diff.changed.map((c) => ({
      key: c.key,
      baseValue: formatValueForDiff(c.baseValue, c.sensitive, c.key, show),
      targetValue: formatValueForDiff(c.targetValue, c.sensitive, c.key, show),
      sensitive: c.sensitive,
    })),
    identical: diff.identical.map((e) => ({
      key: e.key,
      value: formatValueForDiff(e.value, e.sensitive, e.key, show),
      sensitive: e.sensitive,
    })),
    summary: diff.summary,
  };
  return JSON.stringify(data, null, 2);
}
