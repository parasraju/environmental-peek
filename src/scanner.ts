import { readFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { parseEnv } from "./parser.js";
import type { ParseResult } from "./types.js";

export interface ScanResult {
  filePath: string;
  resolvedPath: string;
  content: string;
  result: ParseResult;
}

export function resolveEnvFile(input?: string): string {
  if (input) {
    if (input === "-") return "-";
    return isAbsolute(input) ? input : resolve(process.cwd(), input);
  }
  return resolve(process.cwd(), ".env");
}

export function readEnvFile(filePath: string): ScanResult {
  if (filePath === "-") {
    // stdin handled separately
    throw new Error("stdin not handled here");
  }

  const resolved = resolveEnvFile(filePath);
  // For default .env case we check existence
  if (!existsSync(resolved)) {
    const err = new Error(`File not found: ${resolved}`) as Error & { code: string; path: string };
    err.code = "ENOENT";
    (err as unknown as { path: string }).path = resolved;
    throw err;
  }

  let content: string;
  try {
    content = readFileSync(resolved, "utf-8");
  } catch (e) {
    throw e;
  }

  const result = parseEnv(content);
  return {
    filePath,
    resolvedPath: resolved,
    content,
    result,
  };
}

export function readFromStdin(): string {
  try {
    return readFileSync(0 as unknown as string, "utf-8");
  } catch {
    return "";
  }
}
