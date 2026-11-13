import { readFileSync, existsSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { resolve, isAbsolute, dirname, join } from "node:path";
import { parseEnv } from "./parser.js";
import { readFromStdin } from "./scanner.js";
import { formatTable, formatJson } from "./formatter.js";
import { diffEnvs, formatDiff, formatDiffJson } from "./diff.js";
import { generateExample, buildExampleJson } from "./generator.js";
import { validateEnv, formatValidation } from "./validator.js";
import { filterEntries } from "./filter.js";
import type { CliOptions } from "./types.js";

// Bug fix (v0.2.2): keep in sync with package.json (envpeek --version).
const VERSION = "0.4.0";

function printHelp(): void {
  const help = `
environmental-peek (envpeek) — Peek inside your .env without accidentally leaking it.

Usage:
  envpeek [file] [options]
  envpeek diff <base> [target] [options]
  envpeek example [file] [options]
  envpeek check [file] [options]

Commands:
  diff <base> [target]    Compare two env files (default target: .env)
  example [file]          Generate a clean .env.example with placeholders (alias: gen-example)
  check [file]            Validate types, URLs, ports, and placeholder leaks (alias: lint)

Arguments:
  file                    Path to env file (default: .env)

Options:
  -f, --file <path>       Specify env file path
  --example               Alias for the example subcommand (generate .env.example)
  -o, --output <path>     Write generated example to file instead of stdout
  --force                 Overwrite an existing output file (with -o)
  --filter <query>        Filter variables matching query (key or value)
  -k, --key <name>        Lookup a specific key exactly
  --show                  Reveal secret values (use with caution)
  --raw                   Alias for --show (reveal raw values)
  --json                  Output as JSON (peek, diff, check, and example; secrets still masked)
  --no-color              Disable ANSI colors
  --quiet                 Only show warnings/errors
  --sort                  Sort variables alphabetically
  --strict                Strict mode for checks (fails on placeholders)
  --style <name>          Placeholder style for example: bracket, dummy, empty
  -h, --help              Show help
  -v, --version           Show version

Examples:
  npx envpeek
  envpeek .env.local
  envpeek --filter API
  envpeek -k DATABASE_URL
  envpeek diff .env.example .env
  envpeek example .env -o .env.example
  envpeek example .env --json
  envpeek --example .env > .env.example
  envpeek check .env --strict
  cat .env | envpeek -

Security:
  Secrets and sensitive tokens are masked by default.
  Use --show only when strictly necessary.
`.trim();
  console.log(help);
}

type ParsedCliOptions = CliOptions & {
  positionalFile?: string;
  positionalFile2?: string;
  output?: string;
  force?: boolean;
};

function parseArgs(argv: string[]): ParsedCliOptions {
  const opts: ParsedCliOptions = {
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

  // Check first argument for subcommand
  if (args.length > 0) {
    const first = args[0];
    if (first === "diff") {
      opts.command = "diff";
      i = 1;
    } else if (first === "example" || first === "gen-example") {
      opts.command = "example";
      i = 1;
    } else if (first === "check" || first === "lint") {
      opts.command = "check";
      i = 1;
    }
  }

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
    } else if (arg === "--strict") {
      opts.strict = true;
    } else if (arg === "--check") {
      if (opts.command === "diff" || opts.command === "example") {
        console.error(`✗ Unknown option: ${arg}`);
        console.error(`Try: envpeek --help`);
        process.exit(2);
      }
      opts.command = "check";
    } else if (arg === "--example") {
      if (opts.command === "diff" || opts.command === "check") {
        console.error(`✗ Unknown option: ${arg}`);
        console.error(`Try: envpeek --help`);
        process.exit(2);
      }
      opts.command = "example";
    } else if (arg === "--force") {
      opts.force = true;
    } else if (arg === "-o" || arg === "--output") {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        console.error("✗ --output needs a path");
        process.exit(1);
      }
      opts.output = next;
      i++;
    } else if (arg.startsWith("--output=")) {
      const val = arg.slice("--output=".length);
      if (!val) {
        console.error("✗ --output needs a path");
        process.exit(1);
      }
      opts.output = val;
    } else if (arg.startsWith("-o=")) {
      const val = arg.slice("-o=".length);
      if (!val) {
        console.error("✗ --output needs a path");
        process.exit(1);
      }
      opts.output = val;
    } else if (arg === "--filter") {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        console.error(`✗ Missing value for ${arg}`);
        process.exit(2);
      }
      opts.filter = next;
      i++;
    } else if (arg.startsWith("--filter=")) {
      opts.filter = arg.split("=", 2)[1];
    } else if (arg === "-k" || arg === "--key") {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        console.error(`✗ Missing value for ${arg}`);
        process.exit(2);
      }
      opts.key = next;
      i++;
    } else if (arg.startsWith("--key=")) {
      opts.key = arg.split("=", 2)[1];
    } else if (arg === "--style") {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        console.error(`✗ Missing value for ${arg}`);
        process.exit(2);
      }
      opts.placeholderStyle = next as "bracket" | "dummy" | "empty";
      i++;
    } else if (arg.startsWith("--style=")) {
      opts.placeholderStyle = arg.split("=", 2)[1] as "bracket" | "dummy" | "empty";
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
      if (i + 1 < args.length) {
        if (!opts.positionalFile) opts.positionalFile = args[i + 1];
        else if (!opts.positionalFile2) opts.positionalFile2 = args[i + 1];
      }
      break;
    } else if (arg === "-") {
      if (!opts.positionalFile) {
        opts.positionalFile = arg;
      } else if (!opts.positionalFile2) {
        opts.positionalFile2 = arg;
      } else {
        console.error(`✗ Too many arguments: ${arg}`);
        process.exit(2);
      }
    } else if (arg.startsWith("-")) {
      console.error(`✗ Unknown option: ${arg}`);
      console.error(`Try: envpeek --help`);
      process.exit(2);
    } else {
      if (!opts.positionalFile) {
        opts.positionalFile = arg;
      } else if (!opts.positionalFile2) {
        opts.positionalFile2 = arg;
      } else {
        console.error(`✗ Too many arguments: ${arg}`);
        process.exit(2);
      }
    }
    i++;
  }

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

function readEnvContent(filePath: string, useColor: boolean): string {
  if (filePath === "-") {
    const stdinContent = readFromStdin();
    if (!stdinContent) {
      console.error(color("✗ No input received from stdin", "red", useColor));
      process.exit(1);
    }
    return stdinContent;
  }

  const resolved = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) {
    console.error(color(`✗ Could not find ${filePath}`, "red", useColor));
    console.error("");
    console.error(color("Try:", "dim", useColor));
    console.error(`  envpeek .env.local`);
    console.error(`  envpeek --help`);
    process.exit(3);
  }

  try {
    return readFileSync(resolved, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EACCES") {
      console.error(color(`✗ Cannot read ${filePath}`, "red", useColor));
      console.error(color("Check the file permissions and try again.", "dim", useColor));
    } else {
      console.error(color(`✗ Failed to read ${filePath}`, "red", useColor));
    }
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const useColor = shouldUseColor(opts.noColor);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.version) {
    console.log(VERSION);
    process.exit(0);
  }

  if (opts.output !== undefined && opts.command !== "example") {
    console.error("✗ Unknown option: --output (only supported with example)");
    console.error("Try: envpeek --help");
    process.exit(1);
  }

  if (opts.force && !opts.output) {
    console.error("Note: --force only applies with -o");
  }

  // Handle diff subcommand
  if (opts.command === "diff") {
    const baseFile = opts.positionalFile || ".env.example";
    const targetFile = opts.positionalFile2 || opts.file || ".env";

    const baseContent = readEnvContent(baseFile, useColor);
    const targetContent = readEnvContent(targetFile, useColor);

    const baseParsed = parseEnv(baseContent);
    const targetParsed = parseEnv(targetContent);

    const diff = diffEnvs(baseParsed.entries, targetParsed.entries);

    if (opts.json) {
      console.log(formatDiffJson(diff, baseFile, targetFile, { show: opts.show, raw: opts.raw }));
    } else {
      console.log(formatDiff(diff, baseFile, targetFile, {
        noColor: opts.noColor,
        show: opts.show,
        raw: opts.raw,
        quiet: opts.quiet,
      }));
    }
    process.exit(diff.hasDifferences ? 1 : 0);
  }

  // Handle example subcommand
  if (opts.command === "example") {
    const targetInput = getTargetFile(opts);
    const content = readEnvContent(targetInput, useColor);
    const exampleOptions = {
      placeholderStyle: opts.placeholderStyle || "bracket",
    } as const;
    // Text path is unchanged when --json is absent. --show / --raw do not apply:
    // example never reveals secret values.
    const example = generateExample(content, exampleOptions);
    const exampleDoc = opts.json
      ? buildExampleJson(content, targetInput, exampleOptions)
      : undefined;
    const jsonOutput = exampleDoc ? JSON.stringify(exampleDoc, null, 2) : undefined;

    if (opts.output) {
      const resolvedOut = isAbsolute(opts.output)
        ? opts.output
        : resolve(process.cwd(), opts.output);

      if (existsSync(resolvedOut) && !opts.force) {
        console.error(
          color(
            `✗ ${opts.output} already exists — use --force to overwrite`,
            "red",
            useColor
          )
        );
        process.exit(1);
      }

      const outDir = dirname(resolvedOut);
      const tmpFile = join(
        outDir,
        `.envpeek-tmp-${process.pid}-${Date.now()}`
      );
      const body = jsonOutput ?? example;
      try {
        writeFileSync(tmpFile, body + "\n", "utf-8");
        renameSync(tmpFile, resolvedOut);
      } catch (err) {
        try {
          if (existsSync(tmpFile)) unlinkSync(tmpFile);
        } catch {
          // ignore cleanup error
        }
        console.error(
          color(
            `✗ Failed to write ${opts.output}: ${(err as Error).message}`,
            "red",
            useColor
          )
        );
        process.exit(1);
      }

      const keyCount = exampleDoc ? exampleDoc.keys : parseEnv(content).entries.length;
      console.log(`Wrote ${keyCount} keys to ${opts.output}`);
      process.exit(0);
    }

    console.log(jsonOutput ?? example);
    process.exit(0);
  }

  // Read target file for peek or check
  const targetInput = getTargetFile(opts);
  const isStdin = targetInput === "-";
  const displayFile = isStdin ? "<stdin>" : targetInput;
  const content = readEnvContent(targetInput, useColor);
  const result = parseEnv(content);
  let entries = result.entries;

  // Handle check subcommand or --check flag
  if (opts.command === "check") {
    const validation = validateEnv(entries, { strict: opts.strict });
    if (opts.json) {
      console.log(JSON.stringify({ file: displayFile, ...validation }, null, 2));
    } else {
      console.log(formatValidation(validation, displayFile, { noColor: opts.noColor }));
    }
    process.exit(validation.valid ? 0 : 1);
  }

  // Standard inspect: warnings
  if (result.warnings.length > 0 && !opts.quiet && !opts.json) {
    for (const w of result.warnings) {
      console.error(color(`⚠ ${w}`, "yellow", useColor));
    }
  }

  // Filtering
  if (opts.filter || opts.key) {
    entries = filterEntries(entries, {
      filter: opts.filter,
      key: opts.key,
    });
  }

  // Sorting
  if (opts.sort) {
    entries = [...entries].sort((a, b) => a.key.localeCompare(b.key));
  }

  // Warning for --show
  if ((opts.show || opts.raw) && !opts.quiet && !opts.json) {
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
  console.error("✗ Unexpected error");
  if (process.env.DEBUG) {
    console.error(String((err as Error).message).slice(0, 200));
  }
  process.exit(1);
});
