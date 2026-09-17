import { describe, it, expect } from "vitest";
import { detectSecret, maskValue } from "../src/masker.js";

describe("detectSecret", () => {
  const sensitive = [
    "API_KEY",
    "API_SECRET",
    "SECRET_KEY",
    "SECRET",
    "TOKEN",
    "ACCESS_TOKEN",
    "AUTH_TOKEN",
    "PASSWORD",
    "PASS",
    "PWD",
    "PRIVATE_KEY",
    "CLIENT_SECRET",
    "DATABASE_URL",
    "DB_PASSWORD",
    "JWT_SECRET",
    "AUTHORIZATION",
    "BEARER_TOKEN",
    "OPENAI_API_KEY",
    "STRIPE_SECRET_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "GITHUB_TOKEN",
  ];

  for (const key of sensitive) {
    it(`detects ${key} as sensitive`, () => {
      expect(detectSecret(key)).toBe(true);
    });
  }

  it("is case-insensitive", () => {
    expect(detectSecret("openai_api_key")).toBe(true);
    expect(detectSecret("OpenAI_Api_Key")).toBe(true);
    expect(detectSecret("api_key")).toBe(true);
  });

  const nonSensitive = ["PORT", "NODE_ENV", "DEBUG", "NAME", "MY_VALUE", "NORMAL_VALUE"];
  for (const key of nonSensitive) {
    it(`treats ${key} as non-sensitive`, () => {
      expect(detectSecret(key)).toBe(false);
    });
  }
});

describe("maskValue", () => {
  it("masks empty strings", () => {
    expect(maskValue("")).toBe("••••");
  });

  it("masks one-character secrets", () => {
    const masked = maskValue("a");
    expect(masked).toBe("••••");
    expect(masked).not.toContain("a");
  });

  it("masks short secrets fully", () => {
    const masked = maskValue("abc");
    expect(masked).toBe("••••");
    expect(masked).not.toContain("abc");
  });

  it("masks long secrets with prefix", () => {
    const masked = maskValue("sk_live_123456789abcdef");
    expect(masked.startsWith("sk_")).toBe(true);
    expect(masked).toContain("•");
    expect(masked).not.toContain("123456789abcdef");
  });

  it("never exposes entire secret for short values", () => {
    const val = "abcd";
    const masked = maskValue(val);
    expect(masked).not.toBe(val);
    expect(masked).toBe("••••");
  });

  it("masks multiline secrets completely", () => {
    const val = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";
    expect(maskValue(val)).toBe("********");
  });

  it("handles unicode", () => {
    const masked = maskValue("🔑secret12345");
    expect(masked).toContain("•");
  });

  it("handles special characters", () => {
    const masked = maskValue("p@$$w0rd!123");
    expect(masked).toContain("•");
    expect(masked).not.toContain("p@$$w0rd!123");
  });

  it("for empty string returns bullets", () => {
    expect(maskValue("")).toBe("••••");
  });
});
