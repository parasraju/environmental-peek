# environmental-peek

Safely inspect your `.env` files without leaking secrets — environmental peek

```
$ envpeek

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

Missing variables can also be checked against `.env.example`:

```
$ envpeek diff

Missing in .env (1):
  - 🔒 STRIPE_SECRET_KEY: sk_••••••••••••••••
```

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

## How the Masking Works

- **Heuristic secret detection**: Scans key names against 20+ patterns (`API_KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`, `DATABASE_URL`, `JWT_SECRET`, `AWS_`, `STRIPE_`, etc.) and evaluates values for high-entropy tokens and recognizable credential structures.
- **Safe display**: Sensitive values show only a 2–3 character prefix followed by bullets (e.g. `sk_••••••••••••••••`), short values (<=4 chars) are fully masked (`••••`), and multiline secrets are completely redacted (`********`). Non-sensitive values (`PORT=3000`) remain visible.
- **100% local — zero network calls**: Verified fully offline. There are zero HTTP requests, zero telemetry, zero analytics, and zero runtime dependencies. Everything runs strictly in memory on your machine.

## What It Does NOT Do

- It does **not** edit, write to, or overwrite your `.env` files (strictly read-only inspection).
- It does **not** make network calls or transmit your secrets anywhere.
- It does **not** execute shell commands or evaluate code (pure parser, not an evaluator).
- It does **not** cache or persist secrets to disk.

## Links

- **GitHub Repository**: [github.com/parasraju/environmental-peek](https://github.com/parasraju/environmental-peek)
- **npm Package**: [npmjs.com/package/environmental-peek](https://www.npmjs.com/package/environmental-peek)
- **Issue Tracker**: [github.com/parasraju/environmental-peek/issues](https://github.com/parasraju/environmental-peek/issues)

## License

MIT
