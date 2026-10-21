import { describe, it, expect } from "vitest";
import {
  calculateEntropy,
  isHighEntropy,
  detectSecretByValue,
  TOKEN_PATTERNS,
  AWS_PATTERN,
  GITHUB_PATTERN,
  STRIPE_PATTERN,
  SLACK_PATTERN,
  OPENAI_PATTERN,
  JWT_PATTERN,
  PRIVATE_KEY_PATTERN,
} from "../src/secret-patterns.js";
import { detectSecret } from "../src/masker.js";
import { parseEnv } from "../src/parser.js";

const mockStripeLive = ["sk", "live", "mockpattern123456789012"].join("_");
const mockStripeRestricted = ["rk", "live", "mockpattern123456789012"].join("_");

describe("Shannon entropy calculation", () => {
  it("calculates entropy of empty string as 0", () => {
    expect(calculateEntropy("")).toBe(0);
  });

  it("calculates entropy of repeated single character as 0", () => {
    expect(calculateEntropy("a")).toBe(0);
    expect(calculateEntropy("aaaaaa")).toBe(0);
    expect(calculateEntropy("00000000")).toBe(0);
  });

  it("calculates exact entropy for uniform distributions", () => {
    // 2 distinct symbols with equal probability -> log2(2) = 1.0
    expect(calculateEntropy("ab")).toBeCloseTo(1.0, 5);
    expect(calculateEntropy("abababab")).toBeCloseTo(1.0, 5);

    // 4 distinct symbols with equal probability -> log2(4) = 2.0
    expect(calculateEntropy("abcd")).toBeCloseTo(2.0, 5);

    // 8 distinct symbols with equal probability -> log2(8) = 3.0
    expect(calculateEntropy("01234567")).toBeCloseTo(3.0, 5);

    // 16 distinct symbols with equal probability -> log2(16) = 4.0
    expect(calculateEntropy("0123456789abcdef")).toBeCloseTo(4.0, 5);
  });

  it("yields lower entropy for natural English or simple config strings", () => {
    expect(calculateEntropy("localhost")).toBeLessThan(3.5);
    expect(calculateEntropy("development")).toBeLessThan(3.5);
    expect(calculateEntropy("hello world")).toBeLessThan(3.5);
    expect(calculateEntropy("postgres")).toBeLessThan(3.5);
  });

  it("yields high entropy for random character sequences", () => {
    const highEntropy = calculateEntropy("d8F3!kL9#mP0$qR2%tV4");
    expect(highEntropy).toBeGreaterThan(4.0);
  });
});

describe("isHighEntropy", () => {
  it("returns false for empty or low entropy strings", () => {
    expect(isHighEntropy("")).toBe(false);
    expect(isHighEntropy("hello world")).toBe(false);
    expect(isHighEntropy("production")).toBe(false);
    expect(isHighEntropy("3000")).toBe(false);
    expect(isHighEntropy("short")).toBe(false);
  });

  it("identifies high entropy strings with default threshold (4.0)", () => {
    expect(isHighEntropy("a8b7c9d0e1f2g3h4i5j6k7l8")).toBe(true);
    expect(isHighEntropy("d41d8cd98f00b204e9800998ecf8427e", 3.0)).toBe(true);
    expect(isHighEntropy("d8F3!kL9#mP0$qR2%tV4")).toBe(true);
  });

  it("respects custom threshold", () => {
    // 'abcd' has entropy 2.0
    expect(isHighEntropy("abcd", 1.5)).toBe(true);
    expect(isHighEntropy("abcd", 2.5)).toBe(false);
    expect(isHighEntropy("01234567", 2.9)).toBe(true);
    expect(isHighEntropy("01234567", 3.1)).toBe(false);
  });
});

describe("Known token pattern regexes", () => {
  it("exports all required regex patterns", () => {
    expect(TOKEN_PATTERNS.AWS).toBeDefined();
    expect(TOKEN_PATTERNS.GITHUB).toBeDefined();
    expect(TOKEN_PATTERNS.STRIPE).toBeDefined();
    expect(TOKEN_PATTERNS.SLACK).toBeDefined();
    expect(TOKEN_PATTERNS.OPENAI).toBeDefined();
    expect(TOKEN_PATTERNS.JWT).toBeDefined();
    expect(TOKEN_PATTERNS.PRIVATE_KEY).toBeDefined();

    expect(AWS_PATTERN).toBe(TOKEN_PATTERNS.AWS);
    expect(GITHUB_PATTERN).toBe(TOKEN_PATTERNS.GITHUB);
    expect(STRIPE_PATTERN).toBe(TOKEN_PATTERNS.STRIPE);
    expect(SLACK_PATTERN).toBe(TOKEN_PATTERNS.SLACK);
    expect(OPENAI_PATTERN).toBe(TOKEN_PATTERNS.OPENAI);
    expect(JWT_PATTERN).toBe(TOKEN_PATTERNS.JWT);
    expect(PRIVATE_KEY_PATTERN).toBe(TOKEN_PATTERNS.PRIVATE_KEY);
  });

  it("matches AWS keys (AKIA and ASIA)", () => {
    expect(AWS_PATTERN.test("AKIAIOSFODNN7EXAMPLE")).toBe(true);
    expect(AWS_PATTERN.test("ASIAIOSFODNN7EXAMPLE")).toBe(true);
    expect(AWS_PATTERN.test("NOT_AWS_KEY_12345")).toBe(false);
  });

  it("matches GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_)", () => {
    expect(GITHUB_PATTERN.test("ghp_1234567890abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(GITHUB_PATTERN.test("gho_1234567890abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(GITHUB_PATTERN.test("ghu_1234567890abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(GITHUB_PATTERN.test("ghs_1234567890abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(GITHUB_PATTERN.test("ghr_1234567890abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(GITHUB_PATTERN.test("ghx_1234567890abcdefghijklmnopqrstuvwxyz")).toBe(false);
  });

  it("matches Stripe keys (sk_live_, rk_live_)", () => {
    expect(STRIPE_PATTERN.test(mockStripeLive)).toBe(true);
    expect(STRIPE_PATTERN.test(mockStripeRestricted)).toBe(true);
    expect(STRIPE_PATTERN.test(["pk", "test", "mockpattern123456789012"].join("_"))).toBe(false);
  });

  it("matches Slack tokens (xoxb-, xoxp-, xoxa-)", () => {
    expect(SLACK_PATTERN.test("xoxb-123456789012-1234567890123-abcdef")).toBe(true);
    expect(SLACK_PATTERN.test("xoxp-123456789012-1234567890123-abcdef")).toBe(true);
    expect(SLACK_PATTERN.test("xoxa-123456789012-1234567890123-abcdef")).toBe(true);
    expect(SLACK_PATTERN.test("xoxc-123456789012-1234567890123-abcdef")).toBe(false);
  });

  it("matches OpenAI keys (sk-proj-, sk-)", () => {
    expect(OPENAI_PATTERN.test("sk-proj-abc12345678901234567890")).toBe(true);
    expect(OPENAI_PATTERN.test("sk-1234567890abcdef1234567890abcdef")).toBe(true);
    expect(OPENAI_PATTERN.test("sk-SK")).toBe(false);
  });

  it("matches JWT tokens", () => {
    const validJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsK88";
    expect(JWT_PATTERN.test(validJwt)).toBe(true);
    expect(JWT_PATTERN.test("not.a.jwt")).toBe(false);
  });

  it("matches generic private key headers (-----BEGIN)", () => {
    expect(PRIVATE_KEY_PATTERN.test("-----BEGIN PRIVATE KEY-----")).toBe(true);
    expect(PRIVATE_KEY_PATTERN.test("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
    expect(PRIVATE_KEY_PATTERN.test("-----BEGIN OPENSSH PRIVATE KEY-----")).toBe(true);
    expect(PRIVATE_KEY_PATTERN.test("PUBLIC KEY DATA")).toBe(false);
  });
});

describe("detectSecretByValue", () => {
  it("detects AWS keys by value with reason", () => {
    const resAkia = detectSecretByValue("AKIAIOSFODNN7EXAMPLE");
    expect(resAkia.isSecret).toBe(true);
    expect(resAkia.reason).toContain("AWS");

    const resAsia = detectSecretByValue("ASIAIOSFODNN7EXAMPLE");
    expect(resAsia.isSecret).toBe(true);
    expect(resAsia.reason).toContain("AWS");
  });

  it("detects GitHub tokens by value with reason", () => {
    for (const prefix of ["ghp_", "gho_", "ghu_", "ghs_", "ghr_"]) {
      const res = detectSecretByValue(`${prefix}1234567890abcdefghijklmnopqrstuvwxyz`);
      expect(res.isSecret).toBe(true);
      expect(res.reason).toContain("GitHub");
    }
  });

  it("detects Stripe keys by value with reason", () => {
    const resSk = detectSecretByValue(mockStripeLive);
    expect(resSk.isSecret).toBe(true);
    expect(resSk.reason).toContain("Stripe");

    const resRk = detectSecretByValue(mockStripeRestricted);
    expect(resRk.isSecret).toBe(true);
    expect(resRk.reason).toContain("Stripe");
  });

  it("detects Slack tokens by value with reason", () => {
    for (const prefix of ["xoxb-", "xoxp-", "xoxa-"]) {
      const res = detectSecretByValue(`${prefix}123456789012-1234567890123-abcdef`);
      expect(res.isSecret).toBe(true);
      expect(res.reason).toContain("Slack");
    }
  });

  it("detects OpenAI keys by value with reason", () => {
    const resProj = detectSecretByValue("sk-proj-abc12345678901234567890");
    expect(resProj.isSecret).toBe(true);
    expect(resProj.reason).toContain("OpenAI");

    const resSk = detectSecretByValue("sk-1234567890abcdef1234567890abcdef");
    expect(resSk.isSecret).toBe(true);
    expect(resSk.reason).toContain("OpenAI");
  });

  it("detects JWT tokens by value with reason", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsK88";
    const res = detectSecretByValue(jwt);
    expect(res.isSecret).toBe(true);
    expect(res.reason).toContain("JWT");
  });

  it("detects private key headers by value with reason", () => {
    const res = detectSecretByValue("-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...");
    expect(res.isSecret).toBe(true);
    expect(res.reason).toBeDefined();
  });

  it("detects high entropy strings as potential secrets", () => {
    const highEntropy = "a8b7c9d0e1f2g3h4i5j6k7l8m9n0o1p2";
    const res = detectSecretByValue(highEntropy);
    expect(res.isSecret).toBe(true);
    expect(res.reason).toContain("entropy");
  });

  it("returns isSecret: false for safe non-secret values", () => {
    expect(detectSecretByValue("").isSecret).toBe(false);
    expect(detectSecretByValue("3000").isSecret).toBe(false);
    expect(detectSecretByValue("development").isSecret).toBe(false);
    expect(detectSecretByValue("true").isSecret).toBe(false);
    expect(detectSecretByValue("http://localhost:8080/api/v1").isSecret).toBe(false);
    expect(detectSecretByValue("hello world").isSecret).toBe(false);
  });
});

describe("Integration with detectSecret (src/masker.ts)", () => {
  it("preserves backward compatibility with key-only calls", () => {
    expect(detectSecret("API_KEY")).toBe(true);
    expect(detectSecret("SECRET_TOKEN")).toBe(true);
    expect(detectSecret("PASSWORD")).toBe(true);
    expect(detectSecret("PORT")).toBe(false);
    expect(detectSecret("NODE_ENV")).toBe(false);
  });

  it("checks key heuristics first and returns true even if value is empty or safe", () => {
    expect(detectSecret("API_KEY", "")).toBe(true);
    expect(detectSecret("SECRET_TOKEN", "safe_word")).toBe(true);
  });

  it("detects secrets from value when key heuristics do not flag the key", () => {
    expect(detectSecret("MY_VARIABLE", "AKIAIOSFODNN7EXAMPLE")).toBe(true);
    expect(detectSecret("CONFIG_VAL", "ghp_1234567890abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(detectSecret("PAYMENT_HANDLER", mockStripeLive)).toBe(true);
    expect(detectSecret("BOT_CONFIG", "xoxb-123456789012-1234567890123-abcdef")).toBe(true);
    expect(detectSecret("MODEL_API", "sk-proj-abc12345678901234567890")).toBe(true);
    expect(detectSecret("AUTH_HEADER", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature")).toBe(true);
    expect(detectSecret("CERT_FILE", "-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
    expect(detectSecret("RANDOM_DATA", "a8b7c9d0e1f2g3h4i5j6k7l8m9n0o1p2")).toBe(true);
  });

  it("returns false when both key and value are safe", () => {
    expect(detectSecret("PORT", "3000")).toBe(false);
    expect(detectSecret("NODE_ENV", "production")).toBe(false);
    expect(detectSecret("HOST", "localhost")).toBe(false);
    expect(detectSecret("DEBUG", "false")).toBe(false);
  });
});

describe("Integration with parseEnv (src/parser.ts)", () => {
  it("marks entries with innocent keys but secret values as sensitive", () => {
    const content = [
      "INNOCENT_KEY=ghp_1234567890abcdefghijklmnopqrstuvwxyz",
      "PORT=3000",
      "ANOTHER_KEY=AKIAIOSFODNN7EXAMPLE",
      "SAFE_NAME=production",
    ].join("\n");

    const { entries } = parseEnv(content);
    expect(entries).toHaveLength(4);

    expect(entries[0].key).toBe("INNOCENT_KEY");
    expect(entries[0].sensitive).toBe(true);

    expect(entries[1].key).toBe("PORT");
    expect(entries[1].sensitive).toBe(false);

    expect(entries[2].key).toBe("ANOTHER_KEY");
    expect(entries[2].sensitive).toBe(true);

    expect(entries[3].key).toBe("SAFE_NAME");
    expect(entries[3].sensitive).toBe(false);
  });
});
