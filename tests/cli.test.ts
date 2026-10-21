import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CLI_PATH = resolve("dist/cli.js");

function runCli(args: string, cwd?: string, env: Record<string, string> = {}): { stdout: string; stderr: string; status: number } {
  const result = spawnSync("node", [CLI_PATH, ...args.split(" ").filter(Boolean)], {
    cwd: cwd || process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf-8",
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status ?? 0,
  };
}

describe("CLI", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "envpeek-cli-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("shows help", () => {
    const r = runCli("--help");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("envpeek");
    expect(r.stdout).toContain("Usage");
  });

  it("shows version", () => {
    const r = runCli("--version");
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toMatch(/0\.[12]\./);
  });

  it("errors on missing file", () => {
    const r = runCli(".env", tmpDir);
    expect([3, 1]).toContain(r.status);
    expect(r.stderr).toContain("Could not find");
  });

  it("reads custom file", () => {
    const file = join(tmpDir, ".env.local");
    writeFileSync(file, "PORT=3000\nAPI_KEY=secret123");
    const r = runCli(".env.local", tmpDir);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PORT");
    expect(r.stdout).not.toContain("secret123");
  });

  it("supports --file flag", () => {
    const file = join(tmpDir, "custom.env");
    writeFileSync(file, "PORT=3000");
    const r = runCli(`--file ${file}`);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PORT");
  });

  it("masks secrets by default", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "API_KEY=super-secret-value-123\nPORT=3000");
    const r = runCli(".env", tmpDir);
    expect(r.stdout).not.toContain("super-secret-value-123");
    expect(r.stdout).toContain("PORT");
    expect(r.stdout).toContain("3000");
  });

  it("reveals with --show", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "API_KEY=super-secret-value-123");
    const r = runCli("--show .env", tmpDir);
    expect(r.stdout).toContain("super-secret-value-123");
    expect(r.stderr).toContain("WARNING");
  });

  it("outputs JSON masked", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "API_KEY=super-secret-value-123\nPORT=3000");
    const r = runCli("--json .env", tmpDir);
    expect(r.status).toBe(0);
    const obj = JSON.parse(r.stdout);
    expect(obj.variables.find((v: { key: string }) => v.key === "API_KEY").value).not.toBe("super-secret-value-123");
    expect(obj.variables.find((v: { key: string }) => v.key === "PORT").value).toBe("3000");
  });

  it("outputs JSON revealed with --show", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "API_KEY=super-secret-value-123");
    const r = runCli("--json --show .env", tmpDir);
    const obj = JSON.parse(r.stdout);
    expect(obj.variables[0].value).toBe("super-secret-value-123");
  });

  it("respects NO_COLOR", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "PORT=3000");
    const r = runCli(".env", tmpDir, { NO_COLOR: "1" });
    expect(r.stdout).not.toContain("\x1b[");
  });

  it("handles --no-color flag", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "PORT=3000");
    const r = runCli("--no-color .env", tmpDir);
    expect(r.stdout).not.toContain("\x1b[");
  });

  it("security: sensitive value never appears in default output", () => {
    const file = join(tmpDir, ".env");
    const secret = "super-secret-value-123-xyz";
    writeFileSync(file, `API_KEY=${secret}\nTOKEN=${secret}\nPORT=3000`);
    const r = runCli(".env", tmpDir);
    expect(r.stdout).not.toContain(secret);
    expect(r.stderr).not.toContain(secret);
  });

  it("supports stdin with -", () => {
    const result = spawnSync("node", [CLI_PATH, "-"], {
      input: "PORT=3000\nAPI_KEY=secret123\n",
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PORT");
    expect(result.stdout).not.toContain("secret123");
  });

  it("handles --sort", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "Z_KEY=1\nA_KEY=2");
    const r = runCli("--sort .env", tmpDir);
    const aIdx = r.stdout.indexOf("A_KEY");
    const zIdx = r.stdout.indexOf("Z_KEY");
    expect(aIdx).toBeLessThan(zIdx);
  });

  it("filters variables with --filter", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "DATABASE_URL=postgres://localhost\nPORT=3000\nAPI_KEY=xyz");
    const r = runCli("--filter DATA .env", tmpDir);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("DATABASE_URL");
    expect(r.stdout).not.toContain("PORT");
  });

  it("filters single variable with --key", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "PORT=3000\nAPI_KEY=xyz");
    const r = runCli("-k PORT .env", tmpDir);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PORT");
    expect(r.stdout).not.toContain("API_KEY");
  });

  it("supports diff subcommand", () => {
    const base = join(tmpDir, ".env.example");
    const target = join(tmpDir, ".env");
    writeFileSync(base, "PORT=3000\nSECRET=your_secret");
    writeFileSync(target, "PORT=3000");
    const r = runCli(`diff ${base} ${target}`, tmpDir);
    expect(r.status).toBe(1); // has differences
    expect(r.stdout).toContain("envpeek diff");
    expect(r.stdout.toLowerCase()).toContain("missing in");
    expect(r.stdout).toContain("SECRET");
  });

  it("supports example subcommand", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "PORT=3000\nAPI_KEY=supersecret");
    const r = runCli(`example ${file}`, tmpDir);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PORT=3000");
    expect(r.stdout).toContain("API_KEY=<your-api_key>");
    expect(r.stdout).not.toContain("supersecret");
  });

  it("supports check subcommand", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "PORT=notaport\nDATABASE_URL=postgres://localhost/db");
    const r = runCli(`check ${file}`, tmpDir);
    expect(r.status).toBe(1); // invalid port
    expect(r.stdout).toContain("envpeek check");
    expect(r.stdout).toContain("valid-port");
  });
});
