import { describe, it, expect } from "vitest";
import { parseEnv } from "../src/parser.js";

describe("parseEnv", () => {
  it("parses basic KEY=value", () => {
    const { entries } = parseEnv("PORT=3000");
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe("PORT");
    expect(entries[0].value).toBe("3000");
  });

  it('parses double quoted value', () => {
    const { entries } = parseEnv('NAME="Paras"');
    expect(entries[0].value).toBe("Paras");
  });

  it("parses single quoted value", () => {
    const { entries } = parseEnv("MESSAGE='hello world'");
    expect(entries[0].value).toBe("hello world");
  });

  it("parses empty value", () => {
    const { entries } = parseEnv("EMPTY=");
    expect(entries[0].value).toBe("");
    expect(entries[0].empty).toBe(true);
  });

  it("parses with whitespace around equals", () => {
    const { entries } = parseEnv("PORT = 3000");
    expect(entries[0].key).toBe("PORT");
    expect(entries[0].value).toBe("3000");
  });

  it("ignores comments", () => {
    const { entries } = parseEnv("# Database\nDATABASE_URL=postgres://localhost\n# comment");
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe("DATABASE_URL");
  });

  it("handles whitespace", () => {
    const { entries } = parseEnv("  PORT=3000  ");
    expect(entries[0].value).toBe("3000");
  });

  it("handles inline comments for unquoted values", () => {
    const { entries } = parseEnv("PORT=3000 # this is port");
    expect(entries[0].value).toBe("3000");
  });

  it("preserves # inside quoted values", () => {
    const { entries } = parseEnv('KEY="hello # world"');
    expect(entries[0].value).toBe("hello # world");
  });

  it("handles escaped quotes in double quoted", () => {
    const { entries } = parseEnv('KEY="hello \\"world\\""');
    expect(entries[0].value).toBe('hello "world"');
  });

  it("handles duplicate keys with warning", () => {
    const { entries, warnings } = parseEnv("PORT=3000\nPORT=4000");
    expect(entries).toHaveLength(2);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("Duplicate");
  });

  it("handles special characters", () => {
    const { entries } = parseEnv("DATABASE_URL=postgres://user:pass@localhost/db?ssl=true");
    expect(entries[0].value).toBe("postgres://user:pass@localhost/db?ssl=true");
  });

  it("handles multiline quoted values", () => {
    const content = `PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN\n-----END PRIVATE KEY-----"\nNORMAL=hello`;
    const { entries } = parseEnv(content);
    const pk = entries.find((e) => e.key === "PRIVATE_KEY");
    expect(pk).toBeDefined();
    expect(pk!.value).toContain("BEGIN PRIVATE KEY");
    expect(pk!.value).toContain("\n");
    expect(pk!.sensitive).toBe(true);
  });

  it("skips invalid lines without =", () => {
    const { entries, warnings } = parseEnv("INVALID LINE\nPORT=3000");
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe("PORT");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("preserves order", () => {
    const { entries } = parseEnv("C=3\nA=1\nB=2");
    expect(entries.map((e) => e.key)).toEqual(["C", "A", "B"]);
  });

  it("handles escaped newline in double quotes", () => {
    const { entries } = parseEnv('KEY="line1\\nline2"');
    expect(entries[0].value).toBe("line1\nline2");
  });

  it("handles single quotes preserving content", () => {
    const { entries } = parseEnv("KEY='a \\n b'");
    // single quotes should not unescape \n
    expect(entries[0].value).toBe("a \\n b");
  });
});
