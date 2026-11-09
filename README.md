# environmental-peek

Safely inspect your `.env` files without leaking secrets — environmental peek

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

Compare two files (base first, target second; defaults to `.env.example` vs `.env`):

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

---

## Install

```bash
# Global install (provides `envpeek` and `environmental-peek`)
npm install -g environmental-peek

# Or run directly with npx
npx envpeek
```

## Usage

```bash
envpeek                     # Inspect .env in current directory
envpeek .env.local          # Inspect a specific file
envpeek -f ./config/.env    # Specify file path with -f / --file
cat .env | envpeek -        # Read from stdin

# Subcommands
envpeek diff .env.example .env   # Compare two env files for missing or extra keys
envpeek check .env               # Validate types, URLs, ports, and placeholders
envpeek example .env             # Generate clean .env.example with placeholders
```

### Options

| Flag | Description |
|------|-------------|
| `-f, --file <path>` | Specify env file path (default: `.env`) |
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

## How the Masking Works

- **What is hidden**: variables whose key name matches secret patterns (`API_KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`, `DATABASE_URL`, `JWT`, `AWS_`, `STRIPE_`, ...), values that look like credentials, and any multiline value.
- **What is shown**: a hidden value shows only its first 2–3 characters followed by bullets (`sk_••••••••••••••••`). Values of 4 characters or fewer are fully masked (`••••`), and multiline values are fully redacted (`********`). Non-secret values such as `PORT=3000` are shown as-is.
- **Local only**: the source makes no network calls, spawns no processes, writes no files, and has no runtime dependencies. `.env` files are only read.

## Links

- [GitHub](https://github.com/parasraju/environmental-peek)
- [npm](https://www.npmjs.com/package/environmental-peek)
- [Issues](https://github.com/parasraju/environmental-peek/issues)

## License

MIT
