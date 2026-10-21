import { describe, it, expect } from "vitest";
import {
  generateExample,
  getPlaceholder,
  generatePlaceholder,
} from "../src/generator.js";
import { parseEnv } from "../src/parser.js";
import type { EnvEntry } from "../src/types.js";

describe("generator", () => {
  describe("placeholder generation", () => {
    it("generates placeholders with different styles", () => {
      expect(generatePlaceholder("API_KEY", "bracket")).toBe("<your-api_key>");
      expect(generatePlaceholder("API_KEY", "dummy")).toBe("your_api_key_here");
      expect(generatePlaceholder("API_KEY", "empty")).toBe("");
    });

    it("defaults to bracket style", () => {
      expect(getPlaceholder("DATABASE_URL")).toBe("<your-database_url>");
      expect(generatePlaceholder("DATABASE_URL")).toBe("<your-database_url>");
    });

    it("handles lowercase, uppercase, and mixed case keys", () => {
      expect(getPlaceholder("jwt_secret", "bracket")).toBe("<your-jwt_secret>");
      expect(getPlaceholder("OpenAI_Api_Key", "bracket")).toBe(
        "<your-openai_api_key>"
      );
      expect(getPlaceholder("AWS_SECRET_ACCESS_KEY", "dummy")).toBe(
        "your_aws_secret_access_key_here"
      );
    });
  });

  describe("comments and formatting preservation", () => {
    it("preserves comments, empty lines, and spacing", () => {
      const env = `# Application Settings
PORT=3000

# Security Secrets
# Keep this file safe!
DATABASE_URL=postgres://user:password@localhost:5432/db

# Miscellaneous
DEBUG=true
`;

      const example = generateExample(env);

      expect(example).toContain("# Application Settings");
      expect(example).toContain("# Security Secrets");
      expect(example).toContain("# Keep this file safe!");
      expect(example).toContain("# Miscellaneous");
      expect(example).toContain("PORT=3000");
      expect(example).toContain("DEBUG=true");
      expect(example).toContain("DATABASE_URL=<your-database_url>");
      expect(example).not.toContain("password");
    });

    it("preserves inline comments for both non-sensitive and sensitive keys", () => {
      const env = `PORT=8080 # Web server port
API_KEY=mock_secret_key_123456 # Stripe testing key
NODE_ENV=production # Target environment`;

      const example = generateExample(env);

      expect(example).toContain("PORT=8080 # Web server port");
      expect(example).toContain("API_KEY=<your-api_key> # Stripe testing key");
      expect(example).toContain("NODE_ENV=production # Target environment");
      expect(example).not.toContain("mock_secret_key_123456");
    });

    it("preserves lines without '=' (e.g. malformed lines)", () => {
      const env = `# Comment
INVALID LINE WITHOUT EQUALS
PORT=3000`;

      const example = generateExample(env);

      expect(example).toContain("INVALID LINE WITHOUT EQUALS");
      expect(example).toContain("PORT=3000");
    });

    it("preserves CRLF line endings when present", () => {
      const env = "PORT=3000\r\nAPI_KEY=secret123\r\n";
      const example = generateExample(env);

      expect(example).toContain("\r\n");
      expect(example).toBe("PORT=3000\r\nAPI_KEY=<your-api_key>\r\n");
    });
  });

  describe("secret scrubbing", () => {
    it("scrubs common sensitive keys and replaces them with placeholders", () => {
      const env = `API_KEY=mock_live_secret_123456
API_SECRET=my-super-secret-key
TOKEN=ghp_1234567890abcdef
PASSWORD=supersecretpassword
DATABASE_URL=postgres://admin:pass123@db.example.com:5432/main
JWT_SECRET=jwt-secret-xyz-987
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
PORT=3000
NODE_ENV=development`;

      const example = generateExample(env);

      expect(example).toContain("API_KEY=<your-api_key>");
      expect(example).toContain("API_SECRET=<your-api_secret>");
      expect(example).toContain("TOKEN=<your-token>");
      expect(example).toContain("PASSWORD=<your-password>");
      expect(example).toContain("DATABASE_URL=<your-database_url>");
      expect(example).toContain("JWT_SECRET=<your-jwt_secret>");
      expect(example).toContain("AWS_SECRET_ACCESS_KEY=<your-aws_secret_access_key>");
      expect(example).toContain("PORT=3000");
      expect(example).toContain("NODE_ENV=development");

      // Verify no secrets leaked
      expect(example).not.toContain("mock_live_secret_123456");
      expect(example).not.toContain("my-super-secret-key");
      expect(example).not.toContain("ghp_1234567890abcdef");
      expect(example).not.toContain("supersecretpassword");
      expect(example).not.toContain("pass123");
      expect(example).not.toContain("jwt-secret-xyz-987");
      expect(example).not.toContain("wJalrXUtnFEMI/K7MDENG");
    });

    it("supports dummy placeholder style", () => {
      const env = `API_KEY=secret123
PORT=3000`;

      const example = generateExample(env, { placeholderStyle: "dummy" });

      expect(example).toContain("API_KEY=your_api_key_here");
      expect(example).toContain("PORT=3000");
      expect(example).not.toContain("secret123");
    });

    it("supports empty placeholder style", () => {
      const env = `API_KEY=secret123
PORT=3000`;

      const example = generateExample(env, { placeholderStyle: "empty" });

      expect(example).toContain("API_KEY=");
      expect(example).toContain("PORT=3000");
      expect(example).not.toContain("secret123");
    });

    it("can replace non-sensitive values when preserveNonSensitive is false", () => {
      const env = `PORT=3000
NODE_ENV=development
API_KEY=secret123`;

      const example = generateExample(env, {
        placeholderStyle: "bracket",
        preserveNonSensitive: false,
      });

      expect(example).toContain("PORT=<your-port>");
      expect(example).toContain("NODE_ENV=<your-node_env>");
      expect(example).toContain("API_KEY=<your-api_key>");
    });
  });

  describe("multiline, quotes, and empty values", () => {
    it("handles multiline secrets gracefully by collapsing into a single placeholder line", () => {
      const env = `PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC
-----END PRIVATE KEY-----"
APP=test`;

      const example = generateExample(env, { placeholderStyle: "dummy" });

      expect(example).toContain("PRIVATE_KEY=your_private_key_here");
      expect(example).not.toContain("MIIEvgIBAD");
      expect(example).toContain("APP=test");
    });

    it("handles multiline secrets with bracket placeholder style", () => {
      const env = `# RSA Key
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: DES-EDE3-CBC,3F6E985D3B8EF6C0
...private data...
-----END RSA PRIVATE KEY-----" # RSA 4096
OTHER_VAR=value`;

      const example = generateExample(env, { placeholderStyle: "bracket" });

      expect(example).toContain("PRIVATE_KEY=<your-private_key> # RSA 4096");
      expect(example).not.toContain("private data");
      expect(example).toContain("OTHER_VAR=value");
    });

    it("preserves quotes and special characters for non-sensitive values", () => {
      const env = `NAME="John Doe"
MESSAGE='Hello World'
ESCAPED="Line with \\"escaped\\" quotes"
COLOR="#ffffff"
HAS_HASH="value#with#hashes"`;

      const example = generateExample(env);

      expect(example).toContain('NAME="John Doe"');
      expect(example).toContain("MESSAGE='Hello World'");
      expect(example).toContain('ESCAPED="Line with \\"escaped\\" quotes"');
      expect(example).toContain('COLOR="#ffffff"');
      expect(example).toContain('HAS_HASH="value#with#hashes"');
    });

    it("preserves empty values for non-sensitive variables", () => {
      const env = `EMPTY_VAR=
ANOTHER_EMPTY=
PORT=3000`;

      const example = generateExample(env);

      expect(example).toContain("EMPTY_VAR=");
      expect(example).toContain("ANOTHER_EMPTY=");
      expect(example).toContain("PORT=3000");
    });

    it("handles empty string input", () => {
      expect(generateExample("")).toBe("");
    });
  });

  describe("support for parsed entries", () => {
    it("generates example from EnvEntry array", () => {
      const entries: EnvEntry[] = [
        {
          key: "PORT",
          value: "3000",
          rawValue: "3000",
          sensitive: false,
          empty: false,
          line: 1,
        },
        {
          key: "API_KEY",
          value: "mock_secret_token",
          rawValue: "mock_secret_token",
          sensitive: true,
          empty: false,
          line: 2,
        },
      ];

      const example = generateExample(entries);

      expect(example).toContain("PORT=3000");
      expect(example).toContain("API_KEY=<your-api_key>");
      expect(example).not.toContain("mock_secret_token");
    });

    it("generates example from ParseResult", () => {
      const parsed = parseEnv("PORT=3000\nAPI_KEY=supersecret");
      const example = generateExample(parsed);

      expect(example).toContain("PORT=3000");
      expect(example).toContain("API_KEY=<your-api_key>");
      expect(example).not.toContain("supersecret");
    });
  });
});
