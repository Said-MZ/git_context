#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs_1 = require("fs");
const analyzer_1 = require("./git/analyzer");
const detector_1 = require("./risk/detector");
const derivation_1 = require("./intent/derivation");
const formatter_1 = require("./output/formatter");
const program = new commander_1.Command();
program
    .name('git-context')
    .description('Analyzes Git branches and outputs structured, LLM-ready context with intelligent risk analysis')
    .version('1.0.0')
    .argument('[range]', 'Git revision range (e.g., main...feature-x, HEAD~5..HEAD)', 'main...HEAD')
    .option('-b, --base <branch>', 'Base branch for comparison (overrides range)')
    .option('-c, --compare <branch>', 'Compare branch (overrides range)', 'HEAD')
    .option('-e, --explain', 'Output human-readable summary')
    .option('-j, --json', 'Output as JSON (default)')
    .option('-o, --output <file>', 'Write output to file')
    .action((range, options) => {
    try {
        // Determine the comparison range
        let comparisonRange = range;
        if (options.base) {
            comparisonRange = `${options.base}...${options.compare || 'HEAD'}`;
        }
        const analyzer = new analyzer_1.GitAnalyzer();
        // Verify we're in a git repository
        try {
            analyzer.getCurrentBranch();
        }
        catch {
            console.error('Error: Not a git repository or git is not installed.');
            process.exit(1);
        }
        // Run analysis
        const gitAnalysis = analyzer.analyze(comparisonRange);
        if (gitAnalysis.commits.length === 0) {
            console.error(`No commits found in range: ${comparisonRange}`);
            console.error('Hint: Make sure the base branch exists and there are commits to compare.');
            process.exit(1);
        }
        // Run risk analysis
        const risks = (0, detector_1.analyzeRisks)(gitAnalysis);
        // Derive change intent
        const intent = (0, derivation_1.deriveChangeIntent)(gitAnalysis.commits);
        // Build result
        const result = {
            analysis: gitAnalysis,
            risks,
            intent,
            generatedAt: new Date().toISOString(),
        };
        // Format output
        let output;
        if (options.explain) {
            output = (0, formatter_1.formatExplain)(result);
        }
        else {
            output = (0, formatter_1.formatJson)(result);
        }
        // Write or print output
        if (options.output) {
            (0, fs_1.writeFileSync)(options.output, output, 'utf-8');
            console.log(`Output written to: ${options.output}`);
        }
        else {
            console.log(output);
        }
    }
    catch (error) {
        if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
        }
        else {
            console.error('An unexpected error occurred');
        }
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=index.js.map