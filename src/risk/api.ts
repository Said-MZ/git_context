import { FileChange, DiffHunk, ApiChange } from '../types';

const API_FILE_PATTERNS = [
  /routes?\//i,
  /controllers?\//i,
  /endpoints?\//i,
  /api\//i,
  /handlers?\//i,
  /\.routes\.(ts|js)$/i,
  /\.controller\.(ts|js)$/i,
  /\.handler\.(ts|js)$/i,
];

const HTTP_METHOD_PATTERNS = [
  // Express/Koa style
  /\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  // Route decorators (NestJS, etc.)
  /@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*['"`]?([^'"`\)]+)?['"`]?\)/gi,
  // Next.js API routes
  /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/gi,
  // Fastify
  /fastify\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  // Hono
  /app\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
];

const EXPORT_PATTERNS = [
  /export\s+(const|let|var|function|class|interface|type|enum)\s+(\w+)/g,
  /export\s+default\s+(class|function)?\s*(\w+)?/g,
  /export\s*\{([^}]+)\}/g,
  /module\.exports\s*=\s*\{([^}]+)\}/g,
  /module\.exports\.(\w+)\s*=/g,
];

const GRAPHQL_PATTERNS = [
  /type\s+Query\s*\{/g,
  /type\s+Mutation\s*\{/g,
  /type\s+Subscription\s*\{/g,
  /@Query\s*\(/g,
  /@Mutation\s*\(/g,
  /@Resolver\s*\(/g,
];

export function detectApiChanges(
  fileChanges: FileChange[],
  diffHunks: DiffHunk[]
): ApiChange[] {
  const changes: ApiChange[] = [];
  const seen = new Set<string>();

  for (const hunk of diffHunks) {
    const isApiFile = API_FILE_PATTERNS.some((p) => p.test(hunk.file));

    const addedContent = hunk.addedLines.join('\n');
    const removedContent = hunk.removedLines.join('\n');

    // Detect HTTP route changes
    for (const pattern of HTTP_METHOD_PATTERNS) {
      // Find added routes
      const addedMatches = addedContent.matchAll(new RegExp(pattern));
      for (const match of addedMatches) {
        const method = match[1]?.toUpperCase() || match[2]?.toUpperCase();
        const endpoint = match[2] || match[1] || '';
        const key = `${hunk.file}:${method}:${endpoint}:added`;
        if (seen.has(key)) continue;
        seen.add(key);

        changes.push({
          file: hunk.file,
          endpoint: endpoint || undefined,
          method: method || undefined,
          changeType: 'added',
          description: `New ${method} endpoint${endpoint ? `: ${endpoint}` : ''}`,
        });
      }

      // Find removed routes
      const removedMatches = removedContent.matchAll(new RegExp(pattern));
      for (const match of removedMatches) {
        const method = match[1]?.toUpperCase() || match[2]?.toUpperCase();
        const endpoint = match[2] || match[1] || '';
        const key = `${hunk.file}:${method}:${endpoint}:removed`;
        if (seen.has(key)) continue;
        seen.add(key);

        changes.push({
          file: hunk.file,
          endpoint: endpoint || undefined,
          method: method || undefined,
          changeType: 'removed',
          description: `Removed ${method} endpoint${endpoint ? `: ${endpoint}` : ''}`,
        });
      }
    }

    // Detect export changes in API files
    if (isApiFile) {
      for (const pattern of EXPORT_PATTERNS) {
        const addedMatches = addedContent.matchAll(new RegExp(pattern));
        for (const match of addedMatches) {
          const exportName = match[2] || match[1];
          if (!exportName) continue;
          const key = `${hunk.file}:export:${exportName}:added`;
          if (seen.has(key)) continue;
          seen.add(key);

          changes.push({
            file: hunk.file,
            changeType: 'added',
            description: `New export: ${exportName}`,
          });
        }

        const removedMatches = removedContent.matchAll(new RegExp(pattern));
        for (const match of removedMatches) {
          const exportName = match[2] || match[1];
          if (!exportName) continue;
          const key = `${hunk.file}:export:${exportName}:removed`;
          if (seen.has(key)) continue;
          seen.add(key);

          changes.push({
            file: hunk.file,
            changeType: 'removed',
            description: `Removed export: ${exportName}`,
          });
        }
      }
    }

    // Detect GraphQL changes
    for (const pattern of GRAPHQL_PATTERNS) {
      if (pattern.test(addedContent)) {
        const key = `${hunk.file}:graphql:added`;
        if (seen.has(key)) continue;
        seen.add(key);

        changes.push({
          file: hunk.file,
          changeType: 'added',
          description: 'GraphQL schema/resolver modification',
        });
      }
    }
  }

  // Mark files in API directories as potentially modified even if no specific patterns matched
  for (const file of fileChanges) {
    const isApiFile = API_FILE_PATTERNS.some((p) => p.test(file.path));
    if (isApiFile && file.status === 'modified') {
      const key = `${file.path}:modified`;
      if (!seen.has(key)) {
        const existingChange = changes.find((c) => c.file === file.path);
        if (!existingChange) {
          changes.push({
            file: file.path,
            changeType: 'modified',
            description: 'API file modified',
          });
        }
      }
    }
  }

  return changes;
}
