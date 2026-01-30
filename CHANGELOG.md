# Changelog

## 1.1.0

- Risk analysis is now opt-in with `--risk` / `-r` flag
- Without `--risk`, output contains only pure facts: commits, file changes, diffs, stats, and intent
- The `risks` key is omitted entirely from JSON/TOON output when `--risk` is not used
- Security detector: word-boundary path matching (e.g. `key` no longer matches `keyboard.ts`)
- Security detector: removed auth-consumer patterns (`requireAuth`, `hasPermission`) from code pattern matching — files that merely call auth utilities are no longer flagged
- Security detector: inline checks (middleware, login/logout, permission, token handling) now only apply to files already identified as security-related by path
- Security detector: `.compare()` pattern now requires `password`/`hash`/`bcrypt` context
- Breaking changes detector: stricter rename similarity (60% length ratio minimum)
- Breaking changes detector: signature change and rename detection limited to exported functions only
- Dependencies detector: filters out known non-dependency keys from `package.json` parsing
- Dependencies detector: skips values that don't look like version specifiers
- Updated README to document facts-first philosophy and `--risk` flag

## 1.0.3

- Replaced custom TOON implementation with real `@toon-format/toon` library
- Updated README TOON section to reference the actual spec at toonformat.dev

## 1.0.2

- Version bump for npm publish

## 1.0.1

- Renamed CLI command from `git-context` to `gitctx`
- Updated README with correct command name and TOON output section
- Added author, repository, and files config to package.json

## 1.0.0

- Initial release
- Git analysis: commits, file changes, diff hunks, repository stats
- Risk detection: security, data layer, dependencies, API surface, breaking changes
- Change intent derivation from commit messages
- Output formats: JSON (default), human-readable (`--explain`), TOON (`--toon`)
- Custom range support via positional argument or `--base`/`--compare` flags
- File output with `--output`
