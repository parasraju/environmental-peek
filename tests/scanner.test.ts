import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveEnvFile, readEnvFile } from "../src/scanner.js";

describe("scanner", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "envpeek-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves .env by default", () => {
    const resolved = resolveEnvFile();
    expect(resolved.endsWith(".env")).toBe(true);
  });

  it("resolves custom path", () => {
    const resolved = resolveEnvFile(".env.local");
    expect(resolved).toContain(".env.local");
  });

  it("reads existing file", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "PORT=3000\nAPI_KEY=secret123");
    const result = readEnvFile(file);
    expect(result.result.entries).toHaveLength(2);
    expect(result.result.entries[0].key).toBe("PORT");
  });

  it("throws for missing file", () => {
    const file = join(tmpDir, "missing.env");
    expect(() => readEnvFile(file)).toThrow();
    try {
      readEnvFile(file);
    } catch (e) {
      expect((e as NodeJS.ErrnoException).code).toBe("ENOENT");
    }
  });

  it("handles relative path", () => {
    const file = join(tmpDir, "test.env");
    writeFileSync(file, "KEY=value");
    const result = readEnvFile(file);
    expect(result.result.entries[0].value).toBe("value");
  });

  it("handles absolute path", () => {
    const file = join(tmpDir, "abs.env");
    writeFileSync(file, "KEY=value");
    const result = readEnvFile(file);
    expect(result.resolvedPath).toBe(file);
  });

  it("parses malformed file with warnings", () => {
    const file = join(tmpDir, "mal.env");
    writeFileSync(file, "INVALID LINE\nPORT=3000");
    const result = readEnvFile(file);
    expect(result.result.entries).toHaveLength(1);
    expect(result.result.warnings.length).toBeGreaterThan(0);
  });
});
