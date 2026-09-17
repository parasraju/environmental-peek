# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-09-17

### Changed
- Docs: remove legacy alias note from README install

## [0.1.0] - 2026-09-17

### Added
- Initial release of `environmental-peek` (alias `envpeek`)
- Safe `.env` parsing with custom parser (quotes, comments, whitespace, multiline)
- Heuristic secret detection (case-insensitive, 20+ patterns)
- Masking system with prefix preservation and full mask for short/multiline secrets
- Terminal table formatter with color, icons, summary
- JSON output (`--json`) with masked secrets by default
- `--show` / `--raw` to reveal values with warning
- `--file` / `-f` and positional file argument
- `--no-color`, `NO_COLOR` and `FORCE_COLOR` support
- `--quiet`, `--sort` flags
- `--help`, `--version`
- STDIN support via `envpeek -` / `cat .env | envpeek -`
- Programmatic API: `parseEnv`, `maskValue`, `detectSecret`, `formatTable`, `formatJson`
- Cross-platform path handling
- 82 tests, strict TypeScript, tsup build
- Renamed from `envpeek` to `environmental-peek` for npm availability (GitHub: `parasraju/environmental-peek`)
