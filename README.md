# environmental-peek

> Peek inside your `.env` without accidentally leaking it. *(aka `envpeek`)*

**Your secrets deserve better than `console.log(process.env)`**

`environmental-peek` (binary: `envpeek` + `environmental-peek`) is a safe, fast, modern CLI for inspecting `.env` files. Secrets are masked by default — never leak tokens in your terminal, screenshots, recordings, or CI logs.

---

## Install

```bash
npm install -g environmental-peek
# or
npx environmental-peek
```

## Quick start

```bash
npx environmental-peek
# or
npx envpeek
```

Finds `.env` in the current directory and displays:

```
envpeek

Environment: .env
────────────────────────────────────────

✓ DATABASE_URL       ********••••••••
✓ API_KEY             sk-••••••••••••
✓ PORT                3000
✓ NODE_ENV            development
✓ DEBUG               true
✓ EMPTY_VALUE         <empty>

────────────────────────────────────────
6 variables • 2 secrets • 1 empty
```

Safe by default. No secrets printed.

## Usage

```bash
envpeek                 # inspect .env
envpeek .env.local       # custom file
envpeek --file .env.production
envpeek -f ./config/.env
cat .env | envpeek -    # stdin
```

## Options

| Flag | Description |
|------|-------------|
| `-f, --file <path>` | Specify env file |
| `--show` | Reveal secret values (with warning) |
| `--raw` | Alias for --show |
| `--json` | JSON output (secrets still masked) |
| `--no-color` | Disable ANSI colors (also respects `NO_COLOR`) |
| `--quiet` | Only warnings/errors |
| `--sort` | Sort alphabetically |
| `-h, --help` | Help |
| `-v, --version` | Version |

### Reveal values

```bash
envpeek --show
```

Shows:

```
⚠ WARNING: You are displaying environment values.
  Make sure your terminal output is not being logged or shared.
```

`--json --show` also reveals in JSON. Without `--show`, JSON is masked.

### JSON output

```bash
envpeek --json
```

```json
{
  "file": ".env",
  "variables": [
    { "key": "PORT", "value": "3000", "sensitive": false, "empty": false },
    { "key": "API_KEY", "value": "sk-••••••••••••", "sensitive": true, "empty": false }
  ],
  "summary": { "total": 2, "sensitive": 1, "empty": 0 }
}
```

### Disable colors

```bash
envpeek --no-color
NO_COLOR=1 envpeek
```

Automatically disabled when stdout is not a TTY or when piped.

## Secret detection

Heuristic, case-insensitive name matching:

`API_KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`, `DATABASE_URL`, `JWT_SECRET`, `AWS_SECRET`, `STRIPE_SECRET`, `OPENAI_API`, `GITHUB_TOKEN`, etc.

> **Note:** Detection is heuristic and not a security scanner. A variable like `MY_VALUE=abc123` may still be sensitive. The safety comes from masking — not from perfect detection.

## Masking

```ts
maskValue("sk_live_123456789abcdef") // → "sk_••••••••••••"
maskValue("abc")                     // → "••••"
maskValue("-----BEGIN...")           // multiline → "********"
```

Short values are fully masked. Long values show 2–3 char prefix + bullets. Multiline always `********`.

## Supported `.env` syntax

```env
PORT=3000
NODE_ENV=development
API_KEY=secret
NAME="Paras"
MESSAGE='hello world'
EMPTY=
PORT = 3000
# comment
KEY=value # inline comment

# multiline
PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
```

- `KEY=value`, `KEY="value"`, `KEY='value'`, `KEY=`
- Whitespace around `=`
- `#` comments and `value # inline comment`
- Escaped double quotes: `"hello \"world\""`
- `\n`, `\r`, `\t`, `\"`, `\\` in double quotes
- Multiline quoted values

Not shell execution — `$(rm -rf ...)` is treated as plain text.

## Security

- **No network requests** — fully offline, no telemetry, no analytics
- **No disk writes** — never stores secrets
- **Masked by default** — errors never include raw values
- **No execution** — parser only, not a shell
- `--show` requires explicit opt-in with warning

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid CLI usage |
| 3 | File not found |

## Programmatic API

```ts
import { parseEnv, maskValue, detectSecret, formatTable } from "environmental-peek";

const { entries } = parseEnv('PORT=3000\nAPI_KEY=secret');
detectSecret("API_KEY"); // true
maskValue("secret123");  // "se••••••••"
```

Exports: `parseEnv`, `maskValue`, `detectSecret`, `formatTable`, `formatJson`, `getSummary`, `readEnvFile`, `resolveEnvFile`

## CI usage

Safe in CI — secrets masked:

```bash
npx envpeek --json > env-report.json
# or validate existence
npx envpeek --quiet || echo "missing .env"
```

Never use `--show` in CI logs.

## Development

```bash
npm install
npm test
npm run test:run
npm run typecheck
npm run lint
npm run build
```

## Publishing

```bash
npm run typecheck && npm run lint && npm run test:run && npm run build
npm pack --dry-run
npm publish
```

## Roadmap

- [ ] `envpeek check` — compare `.env.example` vs `.env`
- [ ] Duplicate detection
- [ ] Variable search/filter
- [ ] Shell completions

## License

MIT
