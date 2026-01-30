# gitctx

A CLI tool that extracts structured, LLM-ready context from Git branches.

By default, gitctx outputs **pure facts**: commits, file changes, diffs, and stats. No opinions, no heuristics — just data straight from git.

Opt in to **risk analysis** with `--risk` to get heuristic-based insights on top: security flags, data layer changes, dependency diffs, API surface changes, and breaking change detection.

## Installation

```bash
npm install -g gitctx
```

Or run locally:

```bash
npm install
npm run build
node dist/index.js
```

## Usage

```bash
# Default: pure facts from main...HEAD as JSON
gitctx

# Human-readable summary (facts only)
gitctx --explain

# Token-optimized output for LLMs
gitctx --toon

# Custom range
gitctx HEAD~5..HEAD
gitctx main...feature-branch

# Using base/compare flags
gitctx -b develop -c feature/auth

# Write to file
gitctx --output context.json
gitctx -e -o summary.txt

# Enable risk analysis (heuristic insights on top of facts)
gitctx --risk --explain
gitctx -r -t
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--explain` | `-e` | Output human-readable summary |
| `--json` | `-j` | Output as JSON (default) |
| `--toon` | `-t` | Output token-optimized format for LLMs |
| `--risk` | `-r` | Enable risk analysis (security, data layer, dependencies, API, breaking changes) |
| `--base <branch>` | `-b` | Base branch for comparison |
| `--compare <branch>` | `-c` | Compare branch (default: HEAD) |
| `--output <file>` | `-o` | Write output to file |
| `--version` | `-V` | Show version number |
| `--help` | `-h` | Display help |

## What you get

### Without `--risk` (default): pure facts

- **Commits**: SHA, message, author, timestamp
- **File changes**: Added, modified, deleted, renamed files with line counts
- **Diff hunks**: Line-by-line changes with context
- **Stats**: Total insertions, deletions, file count
- **Intent**: Primary theme derived from commit messages, keyword clustering

This is raw git data structured for LLM consumption. No heuristics, no guesswork.

### With `--risk`: heuristic insights

Everything above, plus:

#### Security-Sensitive Detection
Flags changes to authentication, authorization, and security-related code:

- Files matching: `auth`, `token`, `session`, `password`, `jwt`, `credential`, `secret`
- Patterns: middleware changes, login/logout logic, permission checks
- Code: JWT handling, bcrypt, passport, crypto operations

#### Data Layer Changes
Detects database schema and migration changes:

- Files: `migration`, `schema`, `models`, `*.sql`, `prisma`
- SQL: `CREATE TABLE`, `ALTER TABLE`, `DROP`, `ADD COLUMN`
- ORMs: Prisma, TypeORM, Sequelize, Mongoose, Knex, Drizzle

#### Dependency Changes
Parses and analyzes package manager changes:

- Supports: `package.json`, `Gemfile`, `requirements.txt`, `go.mod`
- Detects: Added, removed, upgraded, downgraded packages
- Version bump type: major, minor, patch

#### API Surface Changes
Identifies changes to public interfaces:

- Files: `routes`, `controllers`, `endpoints`, `api`
- Patterns: HTTP methods, route definitions, exports
- Frameworks: Express, Fastify, NestJS, Next.js, Hono

#### Breaking Change Detection
Finds potentially breaking changes:

- Function signature changes (exported functions only)
- Removed exports
- Renamed functions (heuristic similarity matching)

### TOON Output ([Token-Oriented Object Notation](https://toonformat.dev))

Powered by [`@toon-format/toon`](https://github.com/toon-format/toon):

- ~40% fewer tokens than JSON with better LLM accuracy
- YAML-like indentation for nested structures
- CSV-style tabular layout for uniform arrays
- Lossless, round-trippable representation of JSON

```bash
gitctx main...feature-branch --toon
```

## Output Examples

### Default (`--explain`, no `--risk`)

```
═══════════════════════════════════════════════════════════════
                     GIT CONTEXT ANALYSIS
═══════════════════════════════════════════════════════════════

📊 SUMMARY
───────────────────────────────────────────────────────────────
  Branch comparison: main → feature-auth
  Commits: 5
  Files changed: 12
  Lines: +342 / -28

🎯 CHANGE INTENT
───────────────────────────────────────────────────────────────
  Primary theme: Feature Addition: authentication
  Confidence: HIGH

📝 COMMITS
───────────────────────────────────────────────────────────────
  abc1234 | 1/28/2026 | Alice
         Add auth middleware

📁 FILES CHANGED
───────────────────────────────────────────────────────────────
  ✚ src/auth/middleware.ts (+28/-0)
  ✚ src/auth/login.ts (+45/-0)
```

### With `--risk --explain`

```
═══════════════════════════════════════════════════════════════
                     GIT CONTEXT ANALYSIS
═══════════════════════════════════════════════════════════════

📊 SUMMARY
───────────────────────────────────────────────────────────────
  Branch comparison: main → feature-auth
  Commits: 5
  Files changed: 12
  Lines: +342 / -28

🎯 CHANGE INTENT
───────────────────────────────────────────────────────────────
  Primary theme: Feature Addition: authentication
  Confidence: HIGH

⚠️  RISK ANALYSIS
───────────────────────────────────────────────────────────────
  🔐 SECURITY SENSITIVE: YES
    • src/auth/middleware.ts
      └─ Contains JWT handling
      └─ Permission check modification

  💾 DATA LAYER AFFECTED: YES
    • migrations/001_users.sql
      └─ Tables: users
      └─ Operations: CREATE TABLE

  📦 DEPENDENCY CHANGES
    • ✚ Added: jsonwebtoken@^9.0.0 [npm]
    • ↑ Upgraded: express 4.18.0 → 4.19.0 (minor) [npm]

  🔌 API SURFACE CHANGES
    ✚ New POST endpoint: /auth/login
    ✚ New POST endpoint: /auth/logout

  💥 Breaking changes: None detected

📝 COMMITS
───────────────────────────────────────────────────────────────
  ...

📁 FILES CHANGED
───────────────────────────────────────────────────────────────
  ...
```

### JSON (with `--risk`)

```json
{
  "analysis": {
    "baseBranch": "main",
    "compareBranch": "HEAD",
    "commits": [...],
    "fileChanges": [...],
    "diffHunks": [...],
    "stats": {
      "totalInsertions": 342,
      "totalDeletions": 28,
      "filesChanged": 12,
      "commitsCount": 5
    }
  },
  "risks": {
    "securitySensitive": true,
    "securityRisks": [...],
    "dataLayerAffected": true,
    "dataLayerRisks": [...],
    "dependencyChanges": [...],
    "apiChanges": [...],
    "breakingChanges": []
  },
  "intent": {
    "primaryTheme": "Feature Addition: authentication",
    "keywords": ["add", "feature", "implement"],
    "confidence": "high",
    "commitGroups": [...]
  },
  "generatedAt": "2026-01-28T18:41:00.000Z"
}
```

> Without `--risk`, the `risks` key is omitted entirely from the JSON output.

### TOON Output (`--toon --risk`)

```toon
analysis:
  baseBranch: main
  compareBranch: feature-auth
  commits[5]{sha,shortSha,message,author,authorEmail,timestamp,date}:
    abc123...,abc123,Add auth middleware,Alice,alice@example.com,2026-01-28T18:00:00Z,...
  fileChanges[2]{path,status,oldPath,insertions,deletions}:
    src/auth/middleware.ts,added,null,28,0
    src/auth/login.ts,added,null,45,0
  stats:
    totalInsertions: 342
    totalDeletions: 28
    filesChanged: 12
    commitsCount: 5
risks:
  securitySensitive: true
  securityRisks[1]:
    - file: src/auth/middleware.ts
      reasons[2]: JWT handling,Permission check modification
  ...
intent:
  primaryTheme: "Feature Addition: authentication"
  keywords[3]: add,feature,implement
  confidence: high
```

## Use Cases

### LLM Context Generation
```bash
gitctx --toon --output context.toon
# Pure facts, token-optimized for LLM consumption
```

### Code Review Preparation
```bash
gitctx origin/main...HEAD --explain
```

### Risk Assessment
```bash
gitctx --risk -b main -c $BRANCH_NAME -o risk.json
# Parse risk.json to gate deployments
```

### PR Description Generation
```bash
gitctx HEAD~10..HEAD --explain > pr-context.txt
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev -- HEAD~5..HEAD --explain
```

## License

MIT
