import { describe, it, expect } from "vitest";
import { formatTable, formatJson, getSummary } from "../src/formatter.js";
import type { EnvEntry } from "../src/types.js";

function makeEntry(key: string, value: string, sensitive = false): EnvEntry {
  return {
    key,
    value,
    rawValue: value,
    sensitive,
    empty: value === "",
    line: 1,
  };
}

describe("formatter", () => {
  it("formats table with masked secrets", () => {
    const entries = [makeEntry("API_KEY", "super-secret-123", true), makeEntry("PORT", "3000", false)];
    const out = formatTable(entries, ".env", { show: false, raw: false, noColor: true, quiet: false });
    expect(out).not.toContain("super-secret-123");
    expect(out).toContain("PORT");
    expect(out).toContain("3000");
    expect(out).toContain("•");
  });

  it("shows values when show=true", () => {
    const entries = [makeEntry("API_KEY", "super-secret-123", true)];
    const out = formatTable(entries, ".env", { show: true, raw: false, noColor: true, quiet: false });
    expect(out).toContain("super-secret-123");
  });

  it("shows <empty> for empty values", () => {
    const entries = [makeEntry("EMPTY", "", false)];
    const out = formatTable(entries, ".env", { show: false, raw: false, noColor: true, quiet: false });
    expect(out).toContain("<empty>");
  });

  it("produces JSON with masked secrets by default", () => {
    const entries = [makeEntry("API_KEY", "super-secret-123", true), makeEntry("PORT", "3000", false)];
    const jsonStr = formatJson(entries, ".env", { show: false, raw: false, noColor: true, quiet: false });
    const obj = JSON.parse(jsonStr);
    expect(obj.file).toBe(".env");
    expect(obj.variables[0].value).not.toBe("super-secret-123");
    expect(obj.variables[1].value).toBe("3000");
    expect(obj.summary.total).toBe(2);
  });

  it("produces JSON with revealed values when show", () => {
    const entries = [makeEntry("API_KEY", "super-secret-123", true)];
    const jsonStr = formatJson(entries, ".env", { show: true, raw: true, noColor: true, quiet: false });
    const obj = JSON.parse(jsonStr);
    expect(obj.variables[0].value).toBe("super-secret-123");
  });

  it("getSummary counts correctly", () => {
    const entries = [makeEntry("A", "1", true), makeEntry("B", "", false), makeEntry("C", "2", false)];
    const s = getSummary(entries);
    expect(s.total).toBe(3);
    expect(s.sensitive).toBe(1);
    expect(s.empty).toBe(1);
  });

  it("never includes ANSI in JSON", () => {
    const entries = [makeEntry("PORT", "3000", false)];
    const jsonStr = formatJson(entries, ".env", { show: false, raw: false, noColor: false, quiet: false });
    expect(jsonStr).not.toContain("\x1b[");
  });
});
