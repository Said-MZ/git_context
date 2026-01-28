import { DiffHunk, DependencyChange } from '../types';

interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

function parseVersion(version: string): VersionInfo | null {
  // Remove common prefixes like ^, ~, >=, etc.
  const cleaned = version.replace(/^[\^~>=<]+/, '').trim();
  const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2] || '0', 10),
    patch: parseInt(match[3] || '0', 10),
    raw: version,
  };
}

function getVersionBumpType(
  oldVersion: VersionInfo,
  newVersion: VersionInfo
): 'major' | 'minor' | 'patch' | undefined {
  if (newVersion.major > oldVersion.major) return 'major';
  if (newVersion.major < oldVersion.major) return undefined; // downgrade
  if (newVersion.minor > oldVersion.minor) return 'minor';
  if (newVersion.minor < oldVersion.minor) return undefined; // downgrade
  if (newVersion.patch > oldVersion.patch) return 'patch';
  return undefined;
}

function isDowngrade(oldVersion: VersionInfo, newVersion: VersionInfo): boolean {
  if (newVersion.major < oldVersion.major) return true;
  if (newVersion.major > oldVersion.major) return false;
  if (newVersion.minor < oldVersion.minor) return true;
  if (newVersion.minor > oldVersion.minor) return false;
  return newVersion.patch < oldVersion.patch;
}

function parseNpmDependencies(content: string): Map<string, string> {
  const deps = new Map<string, string>();
  // Match "package-name": "version" patterns
  const regex = /"([^"]+)":\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    deps.set(match[1], match[2]);
  }
  return deps;
}

function parseGemfileDependencies(content: string): Map<string, string> {
  const deps = new Map<string, string>();
  // Match gem 'name', 'version' or gem "name", "version"
  const regex = /gem\s+['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    deps.set(match[1], match[2] || '*');
  }
  return deps;
}

function parsePipDependencies(content: string): Map<string, string> {
  const deps = new Map<string, string>();
  // Match package==version or package>=version patterns
  const regex = /^([a-zA-Z0-9_-]+)(?:[=<>!~]+(.+))?$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    deps.set(match[1], match[2] || '*');
  }
  return deps;
}

function parseGoModDependencies(content: string): Map<string, string> {
  const deps = new Map<string, string>();
  // Match module version patterns in go.mod
  const regex = /^\s*([^\s]+)\s+(v[\d.]+)/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    deps.set(match[1], match[2]);
  }
  return deps;
}

type PackageManager = 'npm' | 'gem' | 'pip' | 'go';

interface DependencyFile {
  pattern: RegExp;
  manager: PackageManager;
  parser: (content: string) => Map<string, string>;
}

const DEPENDENCY_FILES: DependencyFile[] = [
  { pattern: /package\.json$/i, manager: 'npm', parser: parseNpmDependencies },
  { pattern: /package-lock\.json$/i, manager: 'npm', parser: parseNpmDependencies },
  { pattern: /Gemfile$/i, manager: 'gem', parser: parseGemfileDependencies },
  { pattern: /Gemfile\.lock$/i, manager: 'gem', parser: parseGemfileDependencies },
  { pattern: /requirements\.txt$/i, manager: 'pip', parser: parsePipDependencies },
  { pattern: /Pipfile$/i, manager: 'pip', parser: parsePipDependencies },
  { pattern: /go\.mod$/i, manager: 'go', parser: parseGoModDependencies },
  { pattern: /go\.sum$/i, manager: 'go', parser: parseGoModDependencies },
];

export function detectDependencyChanges(diffHunks: DiffHunk[]): DependencyChange[] {
  const changes: DependencyChange[] = [];
  const seen = new Set<string>();

  for (const hunk of diffHunks) {
    const depFile = DEPENDENCY_FILES.find((df) => df.pattern.test(hunk.file));
    if (!depFile) continue;

    const removedContent = hunk.removedLines.join('\n');
    const addedContent = hunk.addedLines.join('\n');

    const oldDeps = depFile.parser(removedContent);
    const newDeps = depFile.parser(addedContent);

    // Detect added dependencies
    for (const [name, version] of newDeps) {
      if (!oldDeps.has(name)) {
        const key = `${depFile.manager}:${name}:added`;
        if (seen.has(key)) continue;
        seen.add(key);

        changes.push({
          name,
          type: 'added',
          newVersion: version,
          packageManager: depFile.manager,
        });
      }
    }

    // Detect removed dependencies
    for (const [name, version] of oldDeps) {
      if (!newDeps.has(name)) {
        const key = `${depFile.manager}:${name}:removed`;
        if (seen.has(key)) continue;
        seen.add(key);

        changes.push({
          name,
          type: 'removed',
          oldVersion: version,
          packageManager: depFile.manager,
        });
      }
    }

    // Detect version changes
    for (const [name, newVersion] of newDeps) {
      if (oldDeps.has(name)) {
        const oldVersion = oldDeps.get(name)!;
        if (oldVersion !== newVersion) {
          const key = `${depFile.manager}:${name}:changed`;
          if (seen.has(key)) continue;
          seen.add(key);

          const oldParsed = parseVersion(oldVersion);
          const newParsed = parseVersion(newVersion);

          let type: 'upgraded' | 'downgraded' = 'upgraded';
          let versionBumpType: 'major' | 'minor' | 'patch' | undefined;

          if (oldParsed && newParsed) {
            if (isDowngrade(oldParsed, newParsed)) {
              type = 'downgraded';
            } else {
              versionBumpType = getVersionBumpType(oldParsed, newParsed);
            }
          }

          changes.push({
            name,
            type,
            oldVersion,
            newVersion,
            versionBumpType,
            packageManager: depFile.manager,
          });
        }
      }
    }
  }

  return changes;
}
