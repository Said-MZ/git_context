import { DiffHunk, BreakingChange } from '../types';

interface FunctionSignature {
  name: string;
  params: string;
  returnType?: string;
  async: boolean;
  exported: boolean;
}

function extractFunctionSignatures(content: string): FunctionSignature[] {
  const signatures: FunctionSignature[] = [];

  // Match various function declaration patterns
  const patterns = [
    // export function name(params): returnType
    /(?:export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/g,
    // export const name = (params): returnType =>
    /(?:export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)(?:\s*:\s*([^=]+))?\s*=>/g,
    // export const name = function(params)
    /(?:export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?function\s*\(([^)]*)\)/g,
    // class method: name(params): returnType
    /(?:public\s+|private\s+|protected\s+)?(async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?(?:\s*\{)/g,
  ];

  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      // Different patterns have different group positions
      let name: string;
      let params: string;
      let returnType: string | undefined;
      let async = false;
      let exported = false;

      if (match[0].startsWith('export')) {
        exported = true;
      }

      if (match[0].includes('function')) {
        // Function declaration pattern
        async = !!match[1];
        name = match[2];
        params = match[3];
        returnType = match[4]?.trim();
      } else if (match[0].includes('=>')) {
        // Arrow function pattern
        async = !!match[3];
        name = match[2];
        params = match[4];
        returnType = match[5]?.trim();
      } else {
        // Class method pattern
        async = !!match[1];
        name = match[2];
        params = match[3];
        returnType = match[4]?.trim();
      }

      if (name && !['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
        signatures.push({ name, params, returnType, async, exported });
      }
    }
  }

  return signatures;
}

function extractExports(content: string): Set<string> {
  const exports = new Set<string>();

  // export { name1, name2 }
  const namedExports = content.matchAll(/export\s*\{([^}]+)\}/g);
  for (const match of namedExports) {
    match[1].split(',').forEach((name) => {
      const trimmed = name.trim().split(/\s+as\s+/)[0].trim();
      if (trimmed) exports.add(trimmed);
    });
  }

  // export const/let/var/function/class name
  const declarations = content.matchAll(
    /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g
  );
  for (const match of declarations) {
    exports.add(match[1]);
  }

  // export default
  const defaultExport = content.match(/export\s+default\s+(?:class|function)?\s*(\w+)?/);
  if (defaultExport) {
    exports.add('default');
    if (defaultExport[1]) exports.add(defaultExport[1]);
  }

  // module.exports
  const moduleExports = content.matchAll(/module\.exports\.(\w+)\s*=/g);
  for (const match of moduleExports) {
    exports.add(match[1]);
  }

  return exports;
}

function normalizeParams(params: string): string {
  // Remove default values and whitespace for comparison
  return params
    .split(',')
    .map((p) => {
      const [name, type] = p.split(':').map((s) => s.trim());
      const paramName = name.split('=')[0].trim();
      return type ? `${paramName}: ${type.split('=')[0].trim()}` : paramName;
    })
    .filter(Boolean)
    .join(', ');
}

function findSimilarName(name: string, names: string[]): string | undefined {
  // Check for common rename patterns
  const lowerName = name.toLowerCase();

  for (const candidate of names) {
    const lowerCandidate = candidate.toLowerCase();

    // Exact match (case insensitive)
    if (lowerName === lowerCandidate) return candidate;

    // Prefix match (e.g., getUser -> getUserById)
    if (lowerCandidate.startsWith(lowerName) || lowerName.startsWith(lowerCandidate)) {
      return candidate;
    }

    // Levenshtein-like similarity (simple version)
    if (lowerName.length >= 3 && lowerCandidate.length >= 3) {
      const shorter = lowerName.length < lowerCandidate.length ? lowerName : lowerCandidate;
      const longer = lowerName.length >= lowerCandidate.length ? lowerName : lowerCandidate;

      if (longer.includes(shorter) || shorter.includes(longer.slice(0, shorter.length))) {
        return candidate;
      }
    }
  }

  return undefined;
}

export function detectBreakingChanges(diffHunks: DiffHunk[]): BreakingChange[] {
  const changes: BreakingChange[] = [];
  const seen = new Set<string>();

  for (const hunk of diffHunks) {
    // Skip non-source files
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(hunk.file)) continue;

    const removedContent = hunk.removedLines.join('\n');
    const addedContent = hunk.addedLines.join('\n');

    const oldSignatures = extractFunctionSignatures(removedContent);
    const newSignatures = extractFunctionSignatures(addedContent);
    const oldExports = extractExports(removedContent);
    const newExports = extractExports(addedContent);

    // Detect removed exports
    for (const exp of oldExports) {
      if (!newExports.has(exp)) {
        const key = `${hunk.file}:removed_export:${exp}`;
        if (seen.has(key)) continue;
        seen.add(key);

        changes.push({
          file: hunk.file,
          type: 'removed_export',
          description: `Removed export: ${exp}`,
        });
      }
    }

    // Detect function signature changes
    for (const oldSig of oldSignatures) {
      const newSig = newSignatures.find((s) => s.name === oldSig.name);

      if (newSig) {
        const oldParams = normalizeParams(oldSig.params);
        const newParams = normalizeParams(newSig.params);

        if (oldParams !== newParams || oldSig.async !== newSig.async) {
          const key = `${hunk.file}:signature_change:${oldSig.name}`;
          if (seen.has(key)) continue;
          seen.add(key);

          changes.push({
            file: hunk.file,
            type: 'signature_change',
            description: `Function signature changed: ${oldSig.name}`,
            oldSignature: `${oldSig.async ? 'async ' : ''}${oldSig.name}(${oldParams})`,
            newSignature: `${newSig.async ? 'async ' : ''}${newSig.name}(${newParams})`,
          });
        }
      }
    }

    // Detect renamed functions (heuristic: similar names in deleted/added)
    const removedNames = oldSignatures
      .filter((s) => !newSignatures.find((ns) => ns.name === s.name))
      .map((s) => s.name);

    const addedNames = newSignatures
      .filter((s) => !oldSignatures.find((os) => os.name === s.name))
      .map((s) => s.name);

    for (const removed of removedNames) {
      const similar = findSimilarName(removed, addedNames);
      if (similar && similar !== removed) {
        const key = `${hunk.file}:renamed_function:${removed}:${similar}`;
        if (seen.has(key)) continue;
        seen.add(key);

        changes.push({
          file: hunk.file,
          type: 'renamed_function',
          description: `Function possibly renamed: ${removed} -> ${similar}`,
          oldSignature: removed,
          newSignature: similar,
        });
      }
    }
  }

  return changes;
}
