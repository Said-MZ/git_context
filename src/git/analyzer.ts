import { execSync } from 'child_process';
import {
  Commit,
  FileChange,
  DiffHunk,
  RepositoryStats,
  GitAnalysis,
} from '../types';

export class GitAnalyzer {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  private exec(command: string): string {
    try {
      return execSync(command, {
        cwd: this.cwd,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large diffs
      }).trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Git command failed: ${error.message}`);
      }
      throw error;
    }
  }

  private parseRange(range: string): { base: string; compare: string } {
    if (range.includes('...')) {
      const [base, compare] = range.split('...');
      return { base, compare };
    } else if (range.includes('..')) {
      const [base, compare] = range.split('..');
      return { base, compare };
    }
    return { base: range, compare: 'HEAD' };
  }

  analyze(range: string = 'main...HEAD'): GitAnalysis {
    const { base, compare } = this.parseRange(range);

    const commits = this.getCommits(base, compare);
    const fileChanges = this.getFileChanges(base, compare);
    const diffHunks = this.getDiffHunks(base, compare);
    const stats = this.getStats(base, compare, commits, fileChanges);

    return {
      baseBranch: base,
      compareBranch: compare,
      commits,
      fileChanges,
      diffHunks,
      stats,
    };
  }

  private getCommits(base: string, compare: string): Commit[] {
    const format = '%H|%h|%s|%an|%ae|%aI';
    const output = this.exec(
      `git log ${base}..${compare} --pretty=format:"${format}"`
    );

    if (!output) return [];

    return output.split('\n').map((line) => {
      const [sha, shortSha, message, author, authorEmail, timestamp] =
        line.split('|');
      return {
        sha,
        shortSha,
        message,
        author,
        authorEmail,
        timestamp,
        date: new Date(timestamp),
      };
    });
  }

  private getFileChanges(base: string, compare: string): FileChange[] {
    const output = this.exec(
      `git diff ${base}...${compare} --numstat --find-renames`
    );

    if (!output) return [];

    const statusOutput = this.exec(
      `git diff ${base}...${compare} --name-status --find-renames`
    );
    const statusMap = new Map<string, { status: string; oldPath?: string }>();

    statusOutput.split('\n').forEach((line) => {
      const parts = line.split('\t');
      const statusCode = parts[0];
      let status: string;
      let oldPath: string | undefined;
      let path: string;

      if (statusCode.startsWith('R')) {
        status = 'renamed';
        oldPath = parts[1];
        path = parts[2];
      } else {
        path = parts[1];
        switch (statusCode) {
          case 'A':
            status = 'added';
            break;
          case 'D':
            status = 'deleted';
            break;
          case 'M':
          default:
            status = 'modified';
        }
      }
      statusMap.set(path, { status, oldPath });
    });

    return output.split('\n').map((line) => {
      const parts = line.split('\t');
      const insertions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
      const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
      const path = parts[2] || parts[1];

      const statusInfo = statusMap.get(path) || { status: 'modified' };

      return {
        path,
        status: statusInfo.status as FileChange['status'],
        oldPath: statusInfo.oldPath,
        insertions,
        deletions,
      };
    });
  }

  private getDiffHunks(base: string, compare: string): DiffHunk[] {
    const output = this.exec(`git diff ${base}...${compare} -U3`);

    if (!output) return [];

    const hunks: DiffHunk[] = [];
    let currentFile = '';
    let currentHunk: DiffHunk | null = null;

    const lines = output.split('\n');

    for (const line of lines) {
      // Match file header
      const fileMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      if (fileMatch) {
        currentFile = fileMatch[2];
        continue;
      }

      // Match hunk header
      const hunkMatch = line.match(
        /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/
      );
      if (hunkMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = {
          file: currentFile,
          oldStart: parseInt(hunkMatch[1], 10),
          oldLines: parseInt(hunkMatch[2] || '1', 10),
          newStart: parseInt(hunkMatch[3], 10),
          newLines: parseInt(hunkMatch[4] || '1', 10),
          content: line,
          addedLines: [],
          removedLines: [],
        };
        continue;
      }

      // Collect diff content
      if (currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentHunk.addedLines.push(line.slice(1));
          currentHunk.content += '\n' + line;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          currentHunk.removedLines.push(line.slice(1));
          currentHunk.content += '\n' + line;
        } else if (line.startsWith(' ')) {
          currentHunk.content += '\n' + line;
        }
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  private getStats(
    base: string,
    compare: string,
    commits: Commit[],
    fileChanges: FileChange[]
  ): RepositoryStats {
    const totalInsertions = fileChanges.reduce((sum, f) => sum + f.insertions, 0);
    const totalDeletions = fileChanges.reduce((sum, f) => sum + f.deletions, 0);

    return {
      totalInsertions,
      totalDeletions,
      filesChanged: fileChanges.length,
      commitsCount: commits.length,
    };
  }

  getCurrentBranch(): string {
    return this.exec('git rev-parse --abbrev-ref HEAD');
  }

  getDefaultBase(): string {
    try {
      this.exec('git rev-parse --verify main');
      return 'main';
    } catch {
      try {
        this.exec('git rev-parse --verify master');
        return 'master';
      } catch {
        return 'HEAD~1';
      }
    }
  }
}
