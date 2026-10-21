import { describe, it, expect } from "vitest";
import { filterEntries } from "../src/filter.js";
import type { EnvEntry } from "../src/types.js";

function makeEntry(
  key: string,
  value: string,
  sensitive = false,
  line = 1
): EnvEntry {
  return {
    key,
    value,
    rawValue: value,
    sensitive,
    empty: value === "",
    line,
  };
}

describe("filterEntries", () => {
  const sampleEntries: EnvEntry[] = [
    makeEntry("DATABASE_URL", "postgres://user:pass@localhost:5432/mydb", true, 1),
    makeEntry("PORT", "3000", false, 2),
    makeEntry("PORT_NAME", "web-server", false, 3),
    makeEntry("API_KEY", "super_secret_token_123", true, 4),
    makeEntry("NODE_ENV", "production", false, 5),
    makeEntry("EMPTY_VAR", "", false, 6),
    makeEntry("STRIPE_SECRET", ["sk", "test", "mock_dummy_key_12345"].join("_"), true, 7),
  ];

  describe("no options / default options", () => {
    it("returns all entries when options are empty or omitted", () => {
      expect(filterEntries(sampleEntries)).toHaveLength(sampleEntries.length);
      expect(filterEntries(sampleEntries, {})).toHaveLength(sampleEntries.length);
    });

    it("returns an empty array when entries list is empty", () => {
      expect(filterEntries([], { filter: "DB" })).toEqual([]);
      expect(filterEntries([], { key: "PORT" })).toEqual([]);
      expect(filterEntries([], { sensitiveOnly: true })).toEqual([]);
    });

    it("does not mutate the input array", () => {
      const copy = [...sampleEntries];
      filterEntries(sampleEntries, { filter: "PORT" });
      expect(sampleEntries).toEqual(copy);
    });
  });

  describe("substring filtering (filter option)", () => {
    it("filters by key substring (e.g. 'DB' matches 'DATABASE_URL')", () => {
      const result = filterEntries(sampleEntries, { filter: "DB" });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("DATABASE_URL");
    });

    it("matches keys case-insensitively (e.g. 'db' matches 'DATABASE_URL')", () => {
      const result = filterEntries(sampleEntries, { filter: "db" });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("DATABASE_URL");
    });

    it("filters by value substring case-insensitively", () => {
      const result = filterEntries(sampleEntries, { filter: "localhost" });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("DATABASE_URL");

      const prodResult = filterEntries(sampleEntries, { filter: "PRODUCTION" });
      expect(prodResult).toHaveLength(1);
      expect(prodResult[0].key).toBe("NODE_ENV");
    });

    it("matches against either key or value", () => {
      // "port" matches PORT (key), PORT_NAME (key), and if any value had port
      const result = filterEntries(sampleEntries, { filter: "port" });
      expect(result.map((e) => e.key)).toEqual(["PORT", "PORT_NAME"]);
    });

    it("filters by numeric substring (e.g. '3000' or '0')", () => {
      const result = filterEntries(sampleEntries, { filter: "3000" });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("PORT");

      const zeroResult = filterEntries(sampleEntries, { filter: "0" });
      expect(zeroResult.map((e) => e.key)).toEqual(["PORT"]);
    });

    it("returns empty array when substring does not match any entry", () => {
      const result = filterEntries(sampleEntries, { filter: "NONEXISTENT_XYZ" });
      expect(result).toEqual([]);
    });

    it("returns all entries when filter string is empty", () => {
      const result = filterEntries(sampleEntries, { filter: "" });
      expect(result).toHaveLength(sampleEntries.length);
    });
  });

  describe("exact key lookup (key option)", () => {
    it("looks up entry with exact key match", () => {
      const result = filterEntries(sampleEntries, { key: "PORT" });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("PORT");
      expect(result[0].value).toBe("3000");
    });

    it("does not match partial key matches", () => {
      const result = filterEntries(sampleEntries, { key: "PORT" });
      // PORT_NAME should not match exact key "PORT"
      expect(result.map((e) => e.key)).toEqual(["PORT"]);
    });

    it("is case-sensitive for exact key matching", () => {
      const result = filterEntries(sampleEntries, { key: "port" });
      expect(result).toEqual([]);
    });

    it("returns empty array for non-existent key", () => {
      const result = filterEntries(sampleEntries, { key: "UNKNOWN_KEY" });
      expect(result).toEqual([]);
    });
  });

  describe("sensitive-only filtering (sensitiveOnly option)", () => {
    it("filters only sensitive variables", () => {
      const result = filterEntries(sampleEntries, { sensitiveOnly: true });
      expect(result.length).toBe(3);
      expect(result.every((e) => e.sensitive)).toBe(true);
      expect(result.map((e) => e.key)).toEqual([
        "DATABASE_URL",
        "API_KEY",
        "STRIPE_SECRET",
      ]);
    });

    it("returns all entries when sensitiveOnly is false", () => {
      const result = filterEntries(sampleEntries, { sensitiveOnly: false });
      expect(result).toHaveLength(sampleEntries.length);
    });

    it("returns empty array when sensitiveOnly is true and no entries are sensitive", () => {
      const nonSensitiveEntries: EnvEntry[] = [
        makeEntry("FOO", "bar", false),
        makeEntry("BAZ", "qux", false),
      ];
      const result = filterEntries(nonSensitiveEntries, { sensitiveOnly: true });
      expect(result).toEqual([]);
    });
  });

  describe("combined options", () => {
    it("combines filter substring and sensitiveOnly", () => {
      // Both DATABASE_URL and API_KEY are sensitive, but only DATABASE_URL contains "data"
      const result = filterEntries(sampleEntries, {
        filter: "data",
        sensitiveOnly: true,
      });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("DATABASE_URL");
    });

    it("combines exact key and sensitiveOnly", () => {
      // PORT exists but is not sensitive
      const nonSensitiveResult = filterEntries(sampleEntries, {
        key: "PORT",
        sensitiveOnly: true,
      });
      expect(nonSensitiveResult).toEqual([]);

      // API_KEY exists and is sensitive
      const sensitiveResult = filterEntries(sampleEntries, {
        key: "API_KEY",
        sensitiveOnly: true,
      });
      expect(sensitiveResult).toHaveLength(1);
      expect(sensitiveResult[0].key).toBe("API_KEY");
    });

    it("combines key, filter, and sensitiveOnly", () => {
      const result = filterEntries(sampleEntries, {
        key: "STRIPE_SECRET",
        filter: "mock_dummy",
        sensitiveOnly: true,
      });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("STRIPE_SECRET");

      const mismatch = filterEntries(sampleEntries, {
        key: "STRIPE_SECRET",
        filter: "non_matching_filter",
        sensitiveOnly: true,
      });
      expect(mismatch).toEqual([]);
    });
  });
});
