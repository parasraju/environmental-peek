const SENSITIVE_PATTERNS = [
  "api_key",
  "api_secret",
  "secret",
  "token",
  "password",
  "pass",
  "pwd",
  "private_key",
  "client_secret",
  "database_url",
  "db_password",
  "jwt_secret",
  "authorization",
  "bearer",
  "aws_secret",
  "aws_access",
  "stripe_secret",
  "openai_api",
  "github_token",
  "access_token",
  "auth_token",
  "secret_key",
] as const;

const SENSITIVE_SUBSTRINGS = [
  "secret",
  "token",
  "password",
  "passwd",
  "pwd",
  "private",
  "credit",
  "aws_",
  "stripe_",
  "openai",
  "github",
];

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

export function detectSecret(key: string): boolean {
  const lower = normalizeKey(key);

  // Exact pattern checks
  for (const p of SENSITIVE_PATTERNS) {
    if (lower === p) return true;
    if (lower.includes(p)) return true;
  }

  // Substring heuristics
  // Check common sensitive substrings
  if (lower.includes("secret")) return true;
  if (lower.includes("token")) return true;
  if (lower.includes("password")) return true;
  if (lower.includes("passwd")) return true;
  if (lower === "pwd" || lower.endsWith("_pwd") || lower.endsWith("_pass") || lower === "pass") return true;
  if (lower.includes("private_key")) return true;
  if (lower.includes("privatekey")) return true;
  if (lower.includes("client_secret")) return true;
  if (lower.includes("database_url")) return true;
  if (lower.includes("db_url")) return true;
  if (lower.includes("jwt")) return true;
  if (lower.includes("bearer")) return true;
  if (lower.includes("authorization")) return true;
  if (lower.includes("auth_token") || lower.includes("access_token")) return true;
  if (lower.includes("api_key")) return true;
  if (lower.includes("api_secret")) return true;

  // Broader checks
  for (const sub of SENSITIVE_SUBSTRINGS) {
    if (lower.includes(sub)) return true;
  }

  return false;
}

export function maskValue(value: string, _key?: string): string {
  if (value === "") return "••••";
  // Multiline secrets -> fully masked
  if (value.includes("\n")) {
    return "********";
  }
  // If value is short, fully mask
  if (value.length <= 4) {
    return "••••";
  }
  // For longer values, show prefix (2 chars) + masked rest
  // But never expose too much: show at most 3 chars prefix
  const prefixLen = Math.min(3, Math.floor(value.length * 0.2));
  const effectivePrefix = prefixLen < 2 ? 2 : prefixLen;
  // Ensure we don't expose more than 3 chars
  const show = Math.min(effectivePrefix, 3);
  const prefix = value.slice(0, show);
  // Mask length: at least 8 bullets, or value length dependent
  const maskLen = Math.max(8, value.length - show);
  // But cap for display: use 12 bullets for long secrets for consistency
  const displayMaskLen = Math.min(maskLen, 16);
  // special handling: if value starts with sk- or similar, keep that prefix visible
  // already handled by prefix slice
  return prefix + "•".repeat(displayMaskLen);
}

// Simpler deterministic mask for tests: used internally
export function maskValueSimple(value: string): string {
  if (value === "") return "••••";
  if (value.includes("\n")) return "********";
  if (value.length <= 4) return "••••";
  const prefix = value.slice(0, 2);
  return prefix + "•".repeat(12);
}
