# gitctx

A TypeScript CLI tool that analyzes Git branches and outputs structured, LLM-ready context with intelligent risk analysis.

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
# Default: compare main...HEAD with JSON output
gitctx

# Human-readable summary
gitctx --explain

# Token-optimized output for LLMs (~80% smaller)
gitctx --toon

# Custom range
gitctx HEAD~5..HEAD
gitctx main...feature-branch

# Using base/compare flags
gitctx -b develop -c feature/auth

# Write to file
gitctx --output context.json
gitctx -e -o summary.txt
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--explain` | `-e` | Output human-readable summary |
| `--json` | `-j` | Output as JSON (default) |
| `--toon` | `-t` | Output token-optimized format for LLMs |
| `--base <branch>` | `-b` | Base branch for comparison |
| `--compare <branch>` | `-c` | Compare branch (default: HEAD) |
| `--output <file>` | `-o` | Write output to file |
| `--version` | `-V` | Show version number |
| `--help` | `-h` | Display help |

## Features

### 1. Git Analysis

Extracts comprehensive information about changes:

- **Commits**: SHA, message, author, timestamp
- **File changes**: Added, modified, deleted, renamed files with stats
- **Diff hunks**: Line-by-line changes with context
- **Repository stats**: Total insertions, deletions, file count

### 2. Intelligent Risk Detection

Heuristic-based risk analysis without calling any LLM:

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

- Function signature changes
- Removed exports
- Renamed functions (heuristic similarity matching)

### 3. Change Intent Derivation

Analyzes commit messages to determine the primary goal:

- Groups commits by keyword clustering
- Identifies themes: Feature, Bug Fix, Refactor, Security, etc.
- Confidence scoring: high (80%+), medium (50-80%), low (<50%)

### 4. TOON Output ([Token-Oriented Object Notation](https://toonformat.dev))

Powered by [`@toon-format/toon`](https://github.com/toon-format/toon):

- ~40% fewer tokens than JSON with better LLM accuracy
- YAML-like indentation for nested structures
- CSV-style tabular layout for uniform arrays
- Lossless, round-trippable representation of JSON

```bash
gitctx main...feature-branch --toon
```

## Output Examples

### Human-Readable (`--explain`)

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
```

### JSON Output

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

### TOON Output (`--toon`)

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

### Code Review Preparation
```bash
gitctx origin/main...HEAD --explain
```

### LLM Context Generation
```bash
gitctx --toon --output context.json
# Feed context.json to your LLM for automated review
```

### CI/CD Risk Assessment
```bash
gitctx -b main -c $BRANCH_NAME -o /tmp/risk.json
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
