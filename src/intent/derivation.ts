import { Commit, ChangeIntent } from '../types';

interface KeywordCluster {
  theme: string;
  keywords: string[];
  weight: number;
}

const KEYWORD_CLUSTERS: KeywordCluster[] = [
  {
    theme: 'Feature Addition',
    keywords: ['add', 'feature', 'implement', 'create', 'new', 'introduce', 'support'],
    weight: 1,
  },
  {
    theme: 'Bug Fix',
    keywords: ['fix', 'bug', 'patch', 'resolve', 'issue', 'error', 'correct', 'repair'],
    weight: 1,
  },
  {
    theme: 'Refactoring',
    keywords: ['refactor', 'restructure', 'reorganize', 'clean', 'improve', 'simplify', 'optimize'],
    weight: 1,
  },
  {
    theme: 'Documentation',
    keywords: ['doc', 'docs', 'documentation', 'readme', 'comment', 'jsdoc', 'typedoc'],
    weight: 0.8,
  },
  {
    theme: 'Testing',
    keywords: ['test', 'spec', 'coverage', 'unit', 'integration', 'e2e', 'mock'],
    weight: 0.9,
  },
  {
    theme: 'Performance',
    keywords: ['perf', 'performance', 'optimize', 'speed', 'cache', 'lazy', 'async'],
    weight: 1,
  },
  {
    theme: 'Security',
    keywords: ['security', 'auth', 'permission', 'vulnerability', 'cve', 'sanitize', 'encrypt'],
    weight: 1.2,
  },
  {
    theme: 'Dependency Update',
    keywords: ['update', 'upgrade', 'bump', 'dependency', 'deps', 'package', 'version'],
    weight: 0.9,
  },
  {
    theme: 'Configuration',
    keywords: ['config', 'setting', 'env', 'environment', 'option', 'configure'],
    weight: 0.8,
  },
  {
    theme: 'UI/UX',
    keywords: ['ui', 'ux', 'style', 'css', 'layout', 'design', 'responsive', 'theme'],
    weight: 0.9,
  },
  {
    theme: 'API Change',
    keywords: ['api', 'endpoint', 'route', 'rest', 'graphql', 'schema'],
    weight: 1,
  },
  {
    theme: 'Database',
    keywords: ['database', 'db', 'migration', 'schema', 'model', 'query', 'sql'],
    weight: 1,
  },
  {
    theme: 'DevOps/CI',
    keywords: ['ci', 'cd', 'deploy', 'docker', 'kubernetes', 'pipeline', 'build', 'release'],
    weight: 0.9,
  },
  {
    theme: 'Removal/Deprecation',
    keywords: ['remove', 'delete', 'deprecate', 'drop', 'cleanup', 'unused'],
    weight: 0.8,
  },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function extractSubject(message: string): string {
  // Get the first line (subject) of the commit message
  const firstLine = message.split('\n')[0];
  // Remove conventional commit prefixes like "feat:", "fix:", etc.
  return firstLine.replace(/^(feat|fix|docs|style|refactor|perf|test|chore|build|ci|revert)(\(.+\))?:\s*/i, '');
}

function scoreCluster(tokens: string[], cluster: KeywordCluster): number {
  let score = 0;
  for (const keyword of cluster.keywords) {
    for (const token of tokens) {
      if (token.includes(keyword) || keyword.includes(token)) {
        score += cluster.weight;
      }
    }
  }
  return score;
}

export function deriveChangeIntent(commits: Commit[]): ChangeIntent {
  if (commits.length === 0) {
    return {
      primaryTheme: 'Unknown',
      keywords: [],
      confidence: 'low',
      commitGroups: [],
    };
  }

  // Collect all tokens from commit messages
  const allTokens: string[] = [];
  const commitTokenMap = new Map<string, string[]>();

  for (const commit of commits) {
    const subject = extractSubject(commit.message);
    const tokens = tokenize(subject);
    allTokens.push(...tokens);
    commitTokenMap.set(commit.sha, tokens);
  }

  // Score each cluster
  const clusterScores = KEYWORD_CLUSTERS.map((cluster) => ({
    cluster,
    score: scoreCluster(allTokens, cluster),
  })).sort((a, b) => b.score - a.score);

  // Get the top cluster(s)
  const topCluster = clusterScores[0];

  // If no matches, try to extract a theme from the most common words
  if (topCluster.score === 0) {
    const wordFreq = new Map<string, number>();
    for (const token of allTokens) {
      wordFreq.set(token, (wordFreq.get(token) || 0) + 1);
    }
    const sortedWords = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]);
    const topWords = sortedWords.slice(0, 3).map(([word]) => word);

    return {
      primaryTheme: topWords.length > 0 ? capitalize(topWords.join(' ')) : 'Miscellaneous changes',
      keywords: topWords,
      confidence: 'low',
      commitGroups: [
        {
          theme: 'All commits',
          commits: commits.map((c) => c.shortSha),
        },
      ],
    };
  }

  // Group commits by their matching clusters
  const commitGroups: { theme: string; commits: string[] }[] = [];
  const assignedCommits = new Set<string>();

  for (const { cluster, score } of clusterScores) {
    if (score === 0) break;

    const matchingCommits: string[] = [];
    for (const commit of commits) {
      if (assignedCommits.has(commit.sha)) continue;

      const tokens = commitTokenMap.get(commit.sha) || [];
      if (scoreCluster(tokens, cluster) > 0) {
        matchingCommits.push(commit.shortSha);
        assignedCommits.add(commit.sha);
      }
    }

    if (matchingCommits.length > 0) {
      commitGroups.push({
        theme: cluster.theme,
        commits: matchingCommits,
      });
    }
  }

  // Add unassigned commits
  const unassignedCommits = commits
    .filter((c) => !assignedCommits.has(c.sha))
    .map((c) => c.shortSha);

  if (unassignedCommits.length > 0) {
    commitGroups.push({
      theme: 'Other',
      commits: unassignedCommits,
    });
  }

  // Calculate confidence
  const topThemeCommitCount = commitGroups[0]?.commits.length || 0;
  const totalCommits = commits.length;
  const matchRatio = topThemeCommitCount / totalCommits;

  let confidence: 'high' | 'medium' | 'low';
  if (matchRatio >= 0.8) {
    confidence = 'high';
  } else if (matchRatio >= 0.5) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Extract relevant keywords
  const relevantKeywords = topCluster.cluster.keywords.filter((kw) =>
    allTokens.some((token) => token.includes(kw) || kw.includes(token))
  );

  // Build a descriptive primary theme
  let primaryTheme = topCluster.cluster.theme;

  // Try to make it more specific based on common tokens
  const subjectTokens = commits.map((c) => extractSubject(c.message)).join(' ');
  const commonNouns = extractCommonNouns(subjectTokens);
  if (commonNouns.length > 0) {
    primaryTheme = `${topCluster.cluster.theme}: ${commonNouns.slice(0, 2).join(', ')}`;
  }

  return {
    primaryTheme,
    keywords: relevantKeywords,
    confidence,
    commitGroups,
  };
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractCommonNouns(text: string): string[] {
  // Simple heuristic: look for capitalized words or common programming terms
  const words = text.split(/\s+/);
  const candidates: string[] = [];

  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z]/g, '');
    if (clean.length > 3) {
      // Skip common verbs and articles
      const skipWords = new Set([
        'the', 'and', 'for', 'from', 'with', 'this', 'that', 'when', 'where',
        'add', 'fix', 'update', 'remove', 'implement', 'create', 'change',
        'refactor', 'move', 'rename', 'improve', 'use', 'make', 'set', 'get',
      ]);
      if (!skipWords.has(clean.toLowerCase())) {
        candidates.push(clean);
      }
    }
  }

  // Count frequency
  const freq = new Map<string, number>();
  for (const word of candidates) {
    const lower = word.toLowerCase();
    freq.set(lower, (freq.get(lower) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}
