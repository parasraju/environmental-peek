import { describe, it, expect } from "vitest";
import { diffEnvs, formatDiff, formatDiffJson } from "../src/diff.js";
import { parseEnv } from "../src/parser.js";
import type { EnvEntry } from "../src/types.js";

function makeEntry(key: string, value: string, sensitive = false, line = 1): EnvEntry {
  return {
    key,
    value,
    rawValue: value,
    sensitive,
    empty: value === "",
    line,
  };
}

describe("diffEnvs", () => {
  it("detects missing variables when target lacks keys present in base", () => {
    const base = [
      makeEntry("PORT", "3000"),
      makeEntry("DATABASE_URL", "postgres://localhost/db", true),
      makeEntry("APP_NAME", "my-app"),
    ];
    const target = [
      makeEntry("PORT", "3000"),
    ];

    const diff = diffEnvs(base, target);

    expect(diff.missing).toHaveLength(2);
    expect(diff.missing.map((e) => e.key)).toEqual(["DATABASE_URL", "APP_NAME"]);
    expect(diff.missing.find((e) => e.key === "DATABASE_URL")?.sensitive).toBe(true);
    expect(diff.extra).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
    expect(diff.identical).toHaveLength(1);
    expect(diff.identical[0].key).toBe("PORT");
    expect(diff.summary.missing).toBe(2);
    expect(diff.summary.identical).toBe(1);
  });

  it("detects extra variables when target has keys not present in base", () => {
    const base = [
      makeEntry("PORT", "3000"),
    ];
    const target = [
      makeEntry("PORT", "3000"),
      makeEntry("DEBUG", "true"),
      makeEntry("NEW_FEATURE", "1"),
    ];

    const diff = diffEnvs(base, target);

    expect(diff.missing).toHaveLength(0);
    expect(diff.extra).toHaveLength(2);
    expect(diff.extra.map((e) => e.key)).toEqual(["DEBUG", "NEW_FEATURE"]);
    expect(diff.identical).toHaveLength(1);
    expect(diff.summary.extra).toBe(2);
  });

  it("detects changed values when keys match but values differ", () => {
    const base = [
      makeEntry("PORT", "3000"),
      makeEntry("API_KEY", "key_old_12345678", true),
      makeEntry("HOST", "localhost"),
    ];
    const target = [
      makeEntry("PORT", "8080"),
      makeEntry("API_KEY", "key_new_87654321", true),
      makeEntry("HOST", "localhost"),
    ];

    const diff = diffEnvs(base, target);

    expect(diff.changed).toHaveLength(2);
    const portChange = diff.changed.find((c) => c.key === "PORT");
    expect(portChange).toBeDefined();
    expect(portChange?.baseValue).toBe("3000");
    expect(portChange?.targetValue).toBe("8080");
    expect(portChange?.sensitive).toBe(false);

    const apiKeyChange = diff.changed.find((c) => c.key === "API_KEY");
    expect(apiKeyChange).toBeDefined();
    expect(apiKeyChange?.baseValue).toBe("key_old_12345678");
    expect(apiKeyChange?.targetValue).toBe("key_new_87654321");
    expect(apiKeyChange?.sensitive).toBe(true);

    expect(diff.identical).toHaveLength(1);
    expect(diff.identical[0].key).toBe("HOST");
    expect(diff.summary.changed).toBe(2);
    expect(diff.summary.identical).toBe(1);
  });

  it("detects identical variables when keys and values match exactly", () => {
    const base = [
      makeEntry("DB_NAME", "production"),
      makeEntry("TIMEOUT", "5000"),
    ];
    const target = [
      makeEntry("DB_NAME", "production"),
      makeEntry("TIMEOUT", "5000"),
    ];

    const diff = diffEnvs(base, target);

    expect(diff.missing).toHaveLength(0);
    expect(diff.extra).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
    expect(diff.identical).toHaveLength(2);
    expect(diff.identical.map((e) => e.key)).toEqual(["DB_NAME", "TIMEOUT"]);
    expect(diff.summary.total).toBe(2);
  });

  it("handles empty arrays", () => {
    const diff = diffEnvs([], []);
    expect(diff.missing).toHaveLength(0);
    expect(diff.extra).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
    expect(diff.identical).toHaveLength(0);
    expect(diff.summary.total).toBe(0);
  });

  it("accepts ParseResult objects or raw strings", () => {
    const baseParsed = parseEnv("PORT=3000\nAPI_KEY=base_secret");
    const targetParsed = parseEnv("PORT=8080\nAPI_KEY=base_secret\nEXTRA=value");

    const diffFromParseResult = diffEnvs(baseParsed, targetParsed);
    expect(diffFromParseResult.changed).toHaveLength(1);
    expect(diffFromParseResult.identical).toHaveLength(1);
    expect(diffFromParseResult.extra).toHaveLength(1);

    const diffFromStrings = diffEnvs("A=1\nB=2", "B=2\nC=3");
    expect(diffFromStrings.missing.map((e) => e.key)).toEqual(["A"]);
    expect(diffFromStrings.identical.map((e) => e.key)).toEqual(["B"]);
    expect(diffFromStrings.extra.map((e) => e.key)).toEqual(["C"]);
  });

  it("safely handles duplicate keys in entries", () => {
    const base = [
      makeEntry("DUPE", "first"),
      makeEntry("DUPE", "second"),
    ];
    const target = [
      makeEntry("DUPE", "second"),
    ];

    const diff = diffEnvs(base, target);
    expect(diff.identical).toHaveLength(1);
    expect(diff.identical[0].value).toBe("second");
    expect(diff.changed).toHaveLength(0);
    expect(diff.missing).toHaveLength(0);
  });
});

describe("formatDiff", () => {
  it("masks sensitive changed values by default", () => {
    const base = [makeEntry("SECRET_TOKEN", "old_super_secret_val", true)];
    const target = [makeEntry("SECRET_TOKEN", "new_super_secret_val", true)];
    const diff = diffEnvs(base, target);

    const output = formatDiff(diff, ".env.example", ".env", { noColor: true });

    expect(output).toContain("SECRET_TOKEN");
    expect(output).not.toContain("old_super_secret_val");
    expect(output).not.toContain("new_super_secret_val");
    expect(output).toContain("•");
    expect(output).toContain(".env.example");
    expect(output).toContain(".env");
  });

  it("unmasks sensitive changed values when show=true", () => {
    const base = [makeEntry("SECRET_TOKEN", "old_super_secret_val", true)];
    const target = [makeEntry("SECRET_TOKEN", "new_super_secret_val", true)];
    const diff = diffEnvs(base, target);

    const output = formatDiff(diff, ".env.example", ".env", { show: true, noColor: true });

    expect(output).toContain("SECRET_TOKEN");
    expect(output).toContain("old_super_secret_val");
    expect(output).toContain("new_super_secret_val");
  });

  it("formats missing variables with safe masking", () => {
    const base = [
      makeEntry("SECRET_KEY", "sensitive_base_value", true),
      makeEntry("NORMAL_VAR", "visible_val", false),
    ];
    const target: EnvEntry[] = [];
    const diff = diffEnvs(base, target);

    const maskedOutput = formatDiff(diff, ".env.example", ".env", { noColor: true });
    expect(maskedOutput).toContain("Missing in .env");
    expect(maskedOutput).toContain("SECRET_KEY");
    expect(maskedOutput).not.toContain("sensitive_base_value");
    expect(maskedOutput).toContain("NORMAL_VAR");
    expect(maskedOutput).toContain("visible_val");

    const revealedOutput = formatDiff(diff, ".env.example", ".env", { show: true, noColor: true });
    expect(revealedOutput).toContain("sensitive_base_value");
  });

  it("formats extra variables with safe masking", () => {
    const base: EnvEntry[] = [];
    const target = [
      makeEntry("PRIVATE_TOKEN", "target_token_value", true),
      makeEntry("PUBLIC_URL", "https://example.com", false),
    ];
    const diff = diffEnvs(base, target);

    const maskedOutput = formatDiff(diff, ".env.example", ".env", { noColor: true });
    expect(maskedOutput).toContain("Extra in .env");
    expect(maskedOutput).toContain("PRIVATE_TOKEN");
    expect(maskedOutput).not.toContain("target_token_value");
    expect(maskedOutput).toContain("PUBLIC_URL");
    expect(maskedOutput).toContain("https://example.com");

    const revealedOutput = formatDiff(diff, ".env.example", ".env", { show: true, noColor: true });
    expect(revealedOutput).toContain("target_token_value");
  });

  it("formats identical variables", () => {
    const base = [makeEntry("COMMON_VAR", "same_value", false)];
    const target = [makeEntry("COMMON_VAR", "same_value", false)];
    const diff = diffEnvs(base, target);

    const output = formatDiff(diff, ".env.example", ".env", { noColor: true });
    expect(output).toContain("Identical (1)");
    expect(output).toContain("COMMON_VAR");
    expect(output).toContain("same_value");
    expect(output).toContain("1 identical");
  });

  it("shows empty values cleanly as <empty>", () => {
    const base = [makeEntry("EMPTY_VAR", "")];
    const target = [makeEntry("EMPTY_VAR", "filled")];
    const diff = diffEnvs(base, target);

    const output = formatDiff(diff, ".env.example", ".env", { noColor: true });
    expect(output).toContain("<empty> -> filled");
  });

  it("handles completely empty environments cleanly", () => {
    const diff = diffEnvs([], []);
    const output = formatDiff(diff, ".env.example", ".env", { noColor: true });
    expect(output).toContain("(no variables found)");
    expect(output).toContain("0 variables");
  });

  it("omits ANSI codes when noColor is true", () => {
    const base = [makeEntry("PORT", "3000")];
    const target = [makeEntry("PORT", "8080")];
    const diff = diffEnvs(base, target);

    const output = formatDiff(diff, ".env.example", ".env", { noColor: true });
    expect(output).not.toContain("\x1b[");
  });

  it("produces valid JSON diff with formatDiffJson", () => {
    const base = [
      makeEntry("PORT", "3000"),
      makeEntry("API_KEY", "base_secret_key", true),
      makeEntry("ONLY_BASE", "foo"),
    ];
    const target = [
      makeEntry("PORT", "4000"),
      makeEntry("API_KEY", "target_secret_key", true),
      makeEntry("ONLY_TARGET", "bar"),
    ];
    const diff = diffEnvs(base, target);

    const jsonStr = formatDiffJson(diff, ".env.example", ".env", { noColor: true });
    const parsed = JSON.parse(jsonStr);

    expect(parsed.baseFile).toBe(".env.example");
    expect(parsed.targetFile).toBe(".env");
    expect(parsed.missing).toHaveLength(1);
    expect(parsed.missing[0].key).toBe("ONLY_BASE");
    expect(parsed.extra).toHaveLength(1);
    expect(parsed.extra[0].key).toBe("ONLY_TARGET");
    expect(parsed.changed).toHaveLength(2);
    // Secret must be masked by default
    const apiChange = parsed.changed.find((c: { key: string }) => c.key === "API_KEY");
    expect(apiChange.baseValue).not.toBe("base_secret_key");
    expect(apiChange.targetValue).not.toBe("target_secret_key");

    // Unmasked json
    const jsonRevealed = JSON.parse(
      formatDiffJson(diff, ".env.example", ".env", { show: true, noColor: true })
    );
    const apiChangeRevealed = jsonRevealed.changed.find((c: { key: string }) => c.key === "API_KEY");
    expect(apiChangeRevealed.baseValue).toBe("base_secret_key");
    expect(apiChangeRevealed.targetValue).toBe("target_secret_key");
  });
});
