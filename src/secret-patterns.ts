/**
 * Secret pattern detection and entropy analysis for envpeek.
 */

export interface TokenPattern {
  name: string;
  pattern: RegExp;
  reason: string;
}

export const TOKEN_PATTERNS = {
  AWS: /(?:AKIA|ASIA)[0-9A-Z]{16}/,
  GITHUB: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+/,
  STRIPE: /(?:sk|rk)_live_[0-9a-zA-Z]+/,
  SLACK: /xox[bpa]-[0-9a-zA-Z-]+/,
  OPENAI: /sk-proj-[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{8,}/,
  JWT: /ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  PRIVATE_KEY: /-----BEGIN/,
} as const;

export const AWS_PATTERN = TOKEN_PATTERNS.AWS;
export const GITHUB_PATTERN = TOKEN_PATTERNS.GITHUB;
export const STRIPE_PATTERN = TOKEN_PATTERNS.STRIPE;
export const SLACK_PATTERN = TOKEN_PATTERNS.SLACK;
export const OPENAI_PATTERN = TOKEN_PATTERNS.OPENAI;
export const JWT_PATTERN = TOKEN_PATTERNS.JWT;
export const PRIVATE_KEY_PATTERN = TOKEN_PATTERNS.PRIVATE_KEY;

export const SECRET_RULES: TokenPattern[] = [
  {
    name: "AWS",
    pattern: TOKEN_PATTERNS.AWS,
    reason: "AWS access key (AKIA/ASIA)",
  },
  {
    name: "GitHub",
    pattern: TOKEN_PATTERNS.GITHUB,
    reason: "GitHub token (ghp/gho/ghu/ghs/ghr)",
  },
  {
    name: "Stripe",
    pattern: TOKEN_PATTERNS.STRIPE,
    reason: "Stripe secret key (sk_live/rk_live)",
  },
  {
    name: "Slack",
    pattern: TOKEN_PATTERNS.SLACK,
    reason: "Slack token (xoxb/xoxp/xoxa)",
  },
  {
    name: "OpenAI",
    pattern: TOKEN_PATTERNS.OPENAI,
    reason: "OpenAI API key (sk-/sk-proj-)",
  },
  {
    name: "JWT",
    pattern: TOKEN_PATTERNS.JWT,
    reason: "JWT (JSON Web Token)",
  },
  {
    name: "Private Key",
    pattern: TOKEN_PATTERNS.PRIVATE_KEY,
    reason: "Generic private key header (-----BEGIN)",
  },
];

/**
 * Calculates the Shannon entropy of a string in bits per character.
 */
export function calculateEntropy(str: string): number {
  if (!str || str.length === 0) {
    return 0;
  }

  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }

  let entropy = 0;
  const len = str.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Determines whether a string has high Shannon entropy above a given threshold.
 * Default threshold is 4.0 bits/char.
 */
export function isHighEntropy(str: string, threshold = 4.0): boolean {
  if (!str || str.length === 0) {
    return false;
  }
  return calculateEntropy(str) >= threshold;
}

export interface ValueDetectionResult {
  isSecret: boolean;
  reason?: string;
}
export type ValueSecretDetection = ValueDetectionResult;

/**
 * Analyzes a string value for known secret token patterns and high Shannon entropy.
 */
export function detectSecretByValue(value: string): ValueDetectionResult {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return { isSecret: false };
  }

  // 1. Check known service token patterns
  for (const rule of SECRET_RULES) {
    if (rule.pattern.test(value)) {
      return {
        isSecret: true,
        reason: rule.reason,
      };
    }
  }

  // 2. High entropy check for random tokens/hashes (min length 16)
  if (value.length >= 16) {
    if (isHighEntropy(value, 4.0) || (!value.includes(" ") && isHighEntropy(value, 3.8))) {
      return {
        isSecret: true,
        reason: "High entropy value (potential secret)",
      };
    }
  }

  return { isSecret: false };
}
