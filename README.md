# environmental-peek

Safely inspect .env files without leaking secrets — mask values, diff against .env.example, generate .env.example

## Install

```bash
# Global install (provides `envpeek` and `environmental-peek`)
npm install -g environmental-peek

# Or run directly with npx
npx envpeek
```

## Generate .env.example

Use `envpeek` as a dotenv example generator to generate .env.example templates directly from your local environment file. You can create .env.example from .env with safe placeholders while keeping non-secret defaults, comments, and blank lines intact:

```bash
envpeek --example .env                       # Print generated .env.example to stdout
envpeek example .env -o .env.example         # Write directly to .env.example (no-clobber by default)
envpeek --example .env -o .env.example       # Flag alias + file output
envpeek example .env -o .env.example --force # Overwrite an existing .env.example
envpeek --example .env --style dummy         # Styles: bracket (default), dummy, empty
```

By default, `-o` / `--output` refuses to overwrite an existing file unless `--force` is passed.

## Check .env against .env.example

Quickly check .env missing variables, invalid ports or URLs, and leftover placeholder values before starting your app:

```bash
envpeek check .env               # Validate types, URLs, ports, and placeholders
envpeek check .env --strict      # Fail if placeholder values remain in .env
envpeek diff .env.example .env   # Check .env against .env.example for missing keys
```

## Mask secrets

`envpeek` lets you mask secrets in terminal output so you can inspect configuration during debugging or screen-sharing without leaking secrets:

```
$ envpeek

envpeek

Environment: .env
────────────────────────────────────────

✓ 🔒 DATABASE_URL        pos••••••••••••••••
✓ 🔒 API_KEY             sk_••••••••••••••••
○ 🔒 STRIPE_SECRET_KEY   <empty>
✓   PORT                3000
✓   NODE_ENV            development

────────────────────────────────────────
5 variables • 3 hidden • 2 visible • 1 empty
```

- **What is hidden**: variables whose key name matches secret patterns (`API_KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`, `DATABASE_URL`, `JWT`, `AWS_`, `STRIPE_`, ...), values that look like credentials, and any multiline value.
- **What is shown**: a hidden value shows only its first 2–3 characters followed by bullets (`sk_••••••••••••••••`). Values of 4 characters or fewer are fully masked (`••••`), and multiline values are fully redacted (`********`). Non-secret values such as `PORT=3000` are shown as-is.
- **Local only**: the source makes no network calls, spawns no processes, writes no files unless `-o` / `--output` is passed with `example`, and has no runtime dependencies.

## Diff .env files

Compare two environment files to diff .env files (base first, target second; defaults to `.env.example` vs `.env`) while keeping secret values masked:

```bash
envpeek diff .env.example .env
envpeek diff .env .env.example
```

```
$ envpeek diff .env.example .env2

envpeek diff

Base:   .env.example
Target: .env2
────────────────────────────────────────

Missing in .env2 (1):
  - 🔒 STRIPE_SECRET_KEY: sk_••••••••••••••••

Changed (1):
  ~ 🔒 DATABASE_URL: pos•••••••••••••••• -> ••••

Identical (3):
  = 🔒 API_KEY: sk_••••••••••••••••
  =   PORT: 3000
  =   NODE_ENV: development

────────────────────────────────────────
1 missing • 1 changed • 3 identical
```

`diff` exits with code 1 when the files differ, 0 when they match.

## Usage

```bash
envpeek                     # Inspect .env in current directory
envpeek .env.local          # Inspect a specific file
envpeek -f ./config/.env    # Specify file path with -f / --file
cat .env | envpeek -        # Read from stdin
```

### Options

| Flag | Description |
|------|-------------|
| `-f, --file <path>` | Specify env file path (default: `.env`) |
| `--example` | Alias for the `example` subcommand (generate `.env.example`) |
| `-o, --output <path>` | Write generated `.env.example` to file instead of stdout |
| `--force` | Overwrite an existing output file (with `-o`) |
| `--filter <query>` | Filter variables by substring match (key or value) |
| `-k, --key <name>` | Lookup a specific key exactly |
| `--show` / `--raw` | Reveal secret values in terminal output (with security warning) |
| `--json` | Output as JSON (secrets remain masked by default) |
| `--no-color` | Disable ANSI colors (also respects `NO_COLOR`) |
| `--quiet` | Only show warnings and errors (suppresses headers/summary) |
| `--sort` | Sort variables alphabetically |
| `--strict` | Strict mode for `check` (fails on placeholders) |
| `--style <name>` | Placeholder style for `example`: `bracket`, `dummy`, `empty` |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

Lines like `export KEY=value` are read as `KEY`. Malformed lines, duplicate keys and unterminated quotes are reported as warnings on stderr and never crash the tool.

## Why envpeek

`dotenv` loads environment variables into `process.env`, `dotenv-linter` lints `.env` files, and `dotenv-cli` runs commands with environment variables loaded. `envpeek` focuses on safe terminal inspection, diffing, and `.env.example` generation:

| feature | envpeek | dotenv | dotenv-linter | dotenv-cli |
|---------|---------|--------|---------------|------------|
| generate .env.example | Yes (`--example`, `-o`) | — | — | — |
| check .env vs .env.example | Yes (`diff`, `check`) | — | — | — |
| diff .env files | Yes (`envpeek diff`) | — | — | — |
| mask secrets in output | Yes (default) | — | — | — |
| inspect .env safely | Yes | — | — | — |

## Links

- [GitHub](https://github.com/parasraju/environmental-peek)
- [npm](https://www.npmjs.com/package/environmental-peek)
- [Issues](https://github.com/parasraju/environmental-peek/issues)

## License

MIT
