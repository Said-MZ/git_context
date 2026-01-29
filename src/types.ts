export interface Commit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail: string;
  timestamp: string;
  date: Date;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  insertions: number;
  deletions: number;
}

export interface DiffHunk {
  file: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
  addedLines: string[];
  removedLines: string[];
}

export interface RepositoryStats {
  totalInsertions: number;
  totalDeletions: number;
  filesChanged: number;
  commitsCount: number;
}

export interface GitAnalysis {
  baseBranch: string;
  compareBranch: string;
  commits: Commit[];
  fileChanges: FileChange[];
  diffHunks: DiffHunk[];
  stats: RepositoryStats;
}

export interface SecurityRisk {
  file: string;
  reasons: string[];
}

export interface DataLayerRisk {
  file: string;
  affectedTables: string[];
  operations: string[];
}

export interface DependencyChange {
  name: string;
  type: 'added' | 'removed' | 'upgraded' | 'downgraded';
  oldVersion?: string;
  newVersion?: string;
  versionBumpType?: 'major' | 'minor' | 'patch';
  packageManager: 'npm' | 'gem' | 'pip' | 'go';
}

export interface ApiChange {
  file: string;
  endpoint?: string;
  method?: string;
  changeType: 'added' | 'modified' | 'removed';
  description: string;
}

export interface BreakingChange {
  file: string;
  type: 'signature_change' | 'removed_export' | 'renamed_function';
  description: string;
  oldSignature?: string;
  newSignature?: string;
}

export interface RiskAnalysis {
  securitySensitive: boolean;
  securityRisks: SecurityRisk[];
  dataLayerAffected: boolean;
  dataLayerRisks: DataLayerRisk[];
  dependencyChanges: DependencyChange[];
  apiChanges: ApiChange[];
  breakingChanges: BreakingChange[];
}

export interface ChangeIntent {
  primaryTheme: string;
  keywords: string[];
  confidence: 'high' | 'medium' | 'low';
  commitGroups: {
    theme: string;
    commits: string[];
  }[];
}

export interface GitContextResult {
  analysis: GitAnalysis;
  risks: RiskAnalysis;
  intent: ChangeIntent;
  generatedAt: string;
}

export interface CLIOptions {
  base?: string;
  compare?: string;
  explain?: boolean;
  json?: boolean;
  toon?: boolean;
  output?: string;
}
