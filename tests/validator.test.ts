import { describe, it, expect } from "vitest";
import { validateEnv, formatValidation } from "../src/validator.js";
import { parseEnv } from "../src/parser.js";

describe("validator", () => {
  it("passes valid environments", () => {
    const { entries } = parseEnv("PORT=3000\nDATABASE_URL=postgres://localhost:5432/db\nDEBUG=true");
    const result = validateEnv(entries);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("catches invalid ports", () => {
    const { entries } = parseEnv("PORT=999999\nAPI_PORT=invalid");
    const result = validateEnv(entries);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].rule).toBe("valid-port");
  });

  it("catches malformed URLs", () => {
    const { entries } = parseEnv("DATABASE_URL=localhost:5432/mydb\nWEBHOOK_URL=not-a-url");
    const result = validateEnv(entries);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].rule).toBe("valid-url");
  });

  it("detects placeholders as warnings in default mode and errors in strict mode", () => {
    const { entries } = parseEnv("API_KEY=<your-api-key>\nSECRET=CHANGEME");
    const defaultResult = validateEnv(entries);
    expect(defaultResult.valid).toBe(true);
    expect(defaultResult.warnings).toHaveLength(2);
    expect(defaultResult.warnings[0].rule).toBe("no-placeholders");

    const strictResult = validateEnv(entries, { strict: true });
    expect(strictResult.valid).toBe(false);
    expect(strictResult.errors).toHaveLength(2);
  });

  it("formats validation output cleanly", () => {
    const { entries } = parseEnv("PORT=notaport");
    const result = validateEnv(entries);
    const formatted = formatValidation(result, ".env", { noColor: true });
    expect(formatted).toContain("envpeek check");
    expect(formatted).toContain("valid-port");
    expect(formatted).toContain("1 error");
  });
});
