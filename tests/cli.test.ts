import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from "node:fs";
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
    expect(r.stdout).toContain("--example");
    expect(r.stdout).toContain("--output");
    expect(r.stdout).toContain("--force");
  });

  it("shows version", () => {
    const r = runCli("--version");
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("0.3.0");
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

  it("supports --example flag alias with identical output to example subcommand", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "# Config\nPORT=3000\nAPI_KEY=sk_test_fake123\nNODE_ENV=development");
    const subRes = runCli(`example ${file}`, tmpDir);
    const flagRes = runCli(`--example ${file}`, tmpDir);
    expect(flagRes.status).toBe(0);
    expect(flagRes.stdout).toBe(subRes.stdout);

    // Composes with --style and -f, and ignores --json
    const styleRes = runCli(`--example -f ${file} --style dummy --json`, tmpDir);
    expect(styleRes.status).toBe(0);
    expect(styleRes.stdout).toContain("API_KEY=your_api_key_here");
    expect(styleRes.stdout).not.toContain("sk_test_fake123");
  });

  it("errors when --example is combined with diff or check", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "PORT=3000");
    const diffRes = runCli(`diff ${file} ${file} --example`, tmpDir);
    expect(diffRes.status).toBe(2);
    expect(diffRes.stderr).toContain("Unknown option: --example");

    const checkRes = runCli(`check ${file} --example`, tmpDir);
    expect(checkRes.status).toBe(2);
    expect(checkRes.stderr).toContain("Unknown option: --example");
  });

  it("writes example output file with -o / --output matching stdout", () => {
    const file = join(tmpDir, ".env");
    const outFile = join(tmpDir, ".env.example");
    writeFileSync(file, "# App\r\nPORT=3000\r\nAPI_KEY=sk_test_fake123\r\nNODE_ENV=development");

    const stdoutRes = runCli(`example ${file}`, tmpDir);
    const writeRes = runCli(`example ${file} -o ${outFile}`, tmpDir);

    expect(writeRes.status).toBe(0);
    expect(writeRes.stdout.trim()).toBe(`Wrote 3 keys to ${outFile}`);
    expect(existsSync(outFile)).toBe(true);

    const written = readFileSync(outFile, "utf-8");
    expect(written).toBe(stdoutRes.stdout);
    expect(written).toContain("\r\n");
    expect(written).not.toContain("sk_test_fake123");
  });

  it("refuses to clobber existing output file without --force and leaves it byte-identical", () => {
    const file = join(tmpDir, ".env");
    const outFile = join(tmpDir, ".env.example");
    const originalContent = "# Hand-edited file\nCUSTOM_KEY=keep_me\n";
    writeFileSync(file, "PORT=3000\nAPI_KEY=sk_test_fake123");
    writeFileSync(outFile, originalContent);

    const failRes = runCli(`--example ${file} -o ${outFile}`, tmpDir);
    expect(failRes.status).toBe(1);
    expect(failRes.stderr).toContain(`✗ ${outFile} already exists — use --force to overwrite`);
    expect(readFileSync(outFile, "utf-8")).toBe(originalContent);

    // Overwrites when --force is passed
    const forceRes = runCli(`--example ${file} --output=${outFile} --force`, tmpDir);
    expect(forceRes.status).toBe(0);
    expect(forceRes.stdout.trim()).toBe(`Wrote 2 keys to ${outFile}`);
    const updatedContent = readFileSync(outFile, "utf-8");
    expect(updatedContent).toContain("PORT=3000");
    expect(updatedContent).toContain("API_KEY=<your-api_key>");
    expect(updatedContent).not.toContain("sk_test_fake123");
  });

  it("never leaks fake secret into written file or stdout", () => {
    const file = join(tmpDir, ".env");
    const outFile = join(tmpDir, ".env.example");
    writeFileSync(file, "API_KEY=sk_test_fake123\nDATABASE_URL=postgres://user:fake_pass@localhost:5432/db");

    const r = runCli(`--example ${file} -o=${outFile}`, tmpDir);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("sk_test_fake123");
    expect(r.stdout).not.toContain("fake_pass");

    const written = readFileSync(outFile, "utf-8");
    expect(written).toContain("API_KEY=<your-api_key>");
    expect(written).toContain("DATABASE_URL=<your-database_url>");
    expect(written).not.toContain("sk_test_fake123");
    expect(written).not.toContain("fake_pass");
  });

  it("prints note when --force is used without -o and still outputs to stdout", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "PORT=3000\nAPI_KEY=sk_test_fake123");

    const r = runCli(`--example ${file} --force`, tmpDir);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("Note: --force only applies with -o");
    expect(r.stdout).toContain("PORT=3000");
    expect(r.stdout).toContain("API_KEY=<your-api_key>");
  });

  it("errors when -o / --output is given with no value", () => {
    const file = join(tmpDir, ".env");
    writeFileSync(file, "PORT=3000");

    const r1 = runCli(`example ${file} -o`, tmpDir);
    expect(r1.status).toBe(1);
    expect(r1.stderr).toContain("✗ --output needs a path");

    const r2 = runCli(`--example ${file} --output --force`, tmpDir);
    expect(r2.status).toBe(1);
    expect(r2.stderr).toContain("✗ --output needs a path");

    const r3 = runCli(`--example ${file} -o=`, tmpDir);
    expect(r3.status).toBe(1);
    expect(r3.stderr).toContain("✗ --output needs a path");
  });

  it("errors when --output is used with diff or check", () => {
    const file = join(tmpDir, ".env");
    const outFile = join(tmpDir, "out.txt");
    writeFileSync(file, "PORT=3000");

    const diffRes = runCli(`diff ${file} ${file} --output ${outFile}`, tmpDir);
    expect(diffRes.status).toBe(1);
    expect(diffRes.stderr).toContain("Unknown option: --output");
    expect(existsSync(outFile)).toBe(false);

    const checkRes = runCli(`check ${file} -o ${outFile}`, tmpDir);
    expect(checkRes.status).toBe(1);
    expect(checkRes.stderr).toContain("Unknown option: --output");
    expect(existsSync(outFile)).toBe(false);
  });

  it("errors cleanly on bad output directory without leaving partial files", () => {
    const file = join(tmpDir, ".env");
    const badOut = join(tmpDir, "nonexistent_dir", ".env.example");
    writeFileSync(file, "PORT=3000\nAPI_KEY=sk_test_fake123");

    const r = runCli(`example ${file} -o ${badOut}`, tmpDir);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("✗ Failed to write");
    const filesInTmp = readdirSync(tmpDir);
    expect(filesInTmp).toEqual([".env"]);
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
