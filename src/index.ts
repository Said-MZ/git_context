#!/usr/bin/env node

import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { GitAnalyzer } from './git/analyzer';
import { analyzeRisks } from './risk/detector';
import { deriveChangeIntent } from './intent/derivation';
import { formatJson, formatExplain, formatToon } from './output/formatter';
import { GitContextResult, CLIOptions } from './types';

const program = new Command();

program
  .name('gitctx')
  .description('Analyzes Git branches and outputs structured, LLM-ready context with intelligent risk analysis')
  .version('1.0.0')
  .argument('[range]', 'Git revision range (e.g., main...feature-x, HEAD~5..HEAD)', 'main...HEAD')
  .option('-b, --base <branch>', 'Base branch for comparison (overrides range)')
  .option('-c, --compare <branch>', 'Compare branch (overrides range)', 'HEAD')
  .option('-e, --explain', 'Output human-readable summary')
  .option('-j, --json', 'Output as JSON (default)')
  .option('-t, --toon', 'Output token-optimized format for LLMs')
  .option('-r, --risk', 'Enable risk analysis (security, data layer, dependencies, API, breaking changes)')
  .option('-o, --output <file>', 'Write output to file')
  .action((range: string, options: CLIOptions) => {
    try {
      // Determine the comparison range
      let comparisonRange = range;
      if (options.base) {
        comparisonRange = `${options.base}...${options.compare || 'HEAD'}`;
      }

      const analyzer = new GitAnalyzer();

      // Verify we're in a git repository
      try {
        analyzer.getCurrentBranch();
      } catch {
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

      // Run risk analysis only when --risk flag is passed
      const risks = options.risk ? analyzeRisks(gitAnalysis) : undefined;

      // Derive change intent
      const intent = deriveChangeIntent(gitAnalysis.commits);

      // Build result
      const result: GitContextResult = {
        analysis: gitAnalysis,
        ...(risks && { risks }),
        intent,
        generatedAt: new Date().toISOString(),
      };

      // Format output
      let output: string;
      if (options.explain) {
        output = formatExplain(result);
      } else if (options.toon) {
        output = formatToon(result);
      } else {
        output = formatJson(result);
      }

      // Write or print output
      if (options.output) {
        writeFileSync(options.output, output, 'utf-8');
        console.log(`Output written to: ${options.output}`);
      } else {
        console.log(output);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('An unexpected error occurred');
      }
      process.exit(1);
    }
  });

program.parse();
