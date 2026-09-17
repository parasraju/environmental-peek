import { readFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { parseEnv } from "./parser.js";
import { readFromStdin } from "./scanner.js";
import { formatTable, formatJson } from "./formatter.js";
import type { CliOptions, EnvEntry } from "./types.js";

const VERSION = "0.1.1";

function printHelp(): void {
  const help = `
environmental-peek (envpeek) — Peek inside your .env without accidentally leaking it.

Usage:
  environmental-peek [file] [options]
  envpeek [file] [options]

Arguments:
  file                    Path to env file (default: .env)

Options:
  -f, --file <path>       Specify env file path
  --show                  Reveal secret values (use with caution)
  --raw                   Alias for --show (reveal raw values)
  --json                  Output as JSON (secrets still masked)
  --no-color              Disable ANSI colors
  --quiet                 Only show warnings/errors
  --sort                  Sort variables alphabetically
  -h, --help              Show help
  -v, --version           Show version

Examples:
  npx envpeek
  envpeek .env.local
  envpeek --file .env.production
  envpeek --json
  envpeek --show
  cat .env | envpeek -

Security:
  Secrets are masked by default. Use --show to reveal values.
  Never pipe --show output to logs or share it.

`.trim();
  console.log(help);
}

function parseArgs(argv: string[]): CliOptions & { positionalFile?: string } {
  const opts: CliOptions & { positionalFile?: string } = {
    show: false,
    raw: false,
    json: false,
    noColor: false,
    quiet: false,
    sort: false,
    help: false,
    version: false,
  };

  const args = argv.slice(2);
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--version" || arg === "-v") {
      opts.version = true;
    } else if (arg === "--show") {
      opts.show = true;
    } else if (arg === "--raw") {
      opts.show = true;
      opts.raw = true;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--no-color") {
      opts.noColor = true;
    } else if (arg === "--quiet") {
      opts.quiet = true;
    } else if (arg === "--sort") {
      opts.sort = true;
    } else if (arg === "--file" || arg === "-f") {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        console.error(`✗ Missing value for ${arg}`);
        process.exit(2);
      }
      opts.file = next;
      i++;
    } else if (arg.startsWith("--file=")) {
      opts.file = arg.split("=", 2)[1];
    } else if (arg.startsWith("-f=")) {
      opts.file = arg.split("=", 2)[1];
    } else if (arg === "--") {
      // everything after is positional
      if (i + 1 < args.length) {
        opts.positionalFile = args[i + 1];
      }
      break;
    } else if (arg === "-") {
      if (!opts.positionalFile) {
        opts.positionalFile = arg;
      } else {
        console.error(`✗ Too many arguments: ${arg}`);
        process.exit(2);
      }
    } else if (arg.startsWith("-")) {
      console.error(`✗ Unknown option: ${arg}`);
      console.error(`Try: envpeek --help`);
      process.exit(2);
    } else {
      // positional file
      if (!opts.positionalFile) {
        opts.positionalFile = arg;
      } else {
        console.error(`✗ Too many arguments: ${arg}`);
        process.exit(2);
      }
    }
    i++;
  }

  // file alias: --file takes precedence, else positional
  return opts;
}

function getTargetFile(opts: CliOptions & { positionalFile?: string }): string {
  if (opts.file) return opts.file;
  if (opts.positionalFile) return opts.positionalFile;
  return ".env";
}

function shouldUseColor(noColor: boolean): boolean {
  if (noColor) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  if (process.stdout && (process.stdout as NodeJS.WriteStream).isTTY === false) return false;
  return true;
}

function color(text: string, code: string, useColor: boolean): string {
  if (!useColor) return text;
  const codes: Record<string, string> = {
    dim: "\x1b[2m",
    bold: "\x1b[1m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    reset: "\x1b[0m",
  };
  return (codes[code] || "") + text + codes.reset;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.version) {
    console.log(VERSION);
    process.exit(0);
  }

  const targetInput = getTargetFile(opts);
  const isStdin = targetInput === "-";

  let content: string;
  let displayFile: string;
  let entries: EnvEntry[];

  if (isStdin) {
    displayFile = "<stdin>";
    content = readFromStdin();
    if (!content) {
      console.error(color("✗ No input received from stdin", "red", shouldUseColor(opts.noColor)));
      process.exit(1);
    }
    const result = parseEnv(content);
    entries = result.entries;
  } else {
    const resolved = isAbsolute(targetInput) ? targetInput : resolve(process.cwd(), targetInput);
    displayFile = targetInput;

    if (!existsSync(resolved)) {
      const useColor = shouldUseColor(opts.noColor);
      console.error(color(`✗ Could not find ${displayFile}`, "red", useColor));
      console.error("");
      console.error(color("Try:", "dim", useColor));
      console.error(`  envpeek .env.local`);
      console.error(`  envpeek --help`);
      process.exit(3);
    }

    try {
      content = readFileSync(resolved, "utf-8");
    } catch (err) {
      const useColor = shouldUseColor(opts.noColor);
      // Never include file content in error
      if ((err as NodeJS.ErrnoException).code === "EACCES") {
        console.error(color(`✗ Cannot read ${displayFile}`, "red", useColor));
        console.error(color("Check the file permissions and try again.", "dim", useColor));
      } else {
        console.error(color(`✗ Failed to read ${displayFile}`, "red", useColor));
      }
      if (process.env.DEBUG) {
        // Still don't log content, just error code
        console.error(color(`  [${(err as NodeJS.ErrnoException).code || "UNKNOWN"}]`, "dim", useColor));
      }
      process.exit(1);
    }

    const result = parseEnv(content);
    entries = result.entries;
    // Warnings: print to stderr but don't include values
    if (result.warnings.length > 0 && !opts.quiet && !opts.json) {
      const useColor = shouldUseColor(opts.noColor);
      for (const w of result.warnings) {
        console.error(color(`⚠ ${w}`, "yellow", useColor));
      }
    }
  }

  if (opts.sort) {
    entries = [...entries].sort((a, b) => a.key.localeCompare(b.key));
  }

  // Warning for --show
  if ((opts.show || opts.raw) && !opts.quiet && !opts.json) {
    const useColor = shouldUseColor(opts.noColor);
    console.error(color("⚠ WARNING: You are displaying environment values.", "yellow", useColor));
    console.error(color("  Make sure your terminal output is not being logged or shared.", "dim", useColor));
    console.error("");
  }

  if (opts.json) {
    const out = formatJson(entries, displayFile, {
      show: opts.show,
      raw: opts.raw,
      noColor: true,
      quiet: opts.quiet,
    });
    console.log(out);
    process.exit(0);
  }

  const output = formatTable(entries, displayFile, {
    show: opts.show,
    raw: opts.raw,
    noColor: opts.noColor,
    quiet: opts.quiet,
  });
  console.log(output);
}

main().catch((err) => {
  // Never leak env content
  console.error("✗ Unexpected error");
  if (process.env.DEBUG) {
    console.error(String((err as Error).message).slice(0, 200));
  }
  process.exit(1);
});
