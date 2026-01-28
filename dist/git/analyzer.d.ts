import { GitAnalysis } from '../types';
export declare class GitAnalyzer {
    private cwd;
    constructor(cwd?: string);
    private exec;
    private parseRange;
    analyze(range?: string): GitAnalysis;
    private getCommits;
    private getFileChanges;
    private getDiffHunks;
    private getStats;
    getCurrentBranch(): string;
    getDefaultBase(): string;
}
//# sourceMappingURL=analyzer.d.ts.map