import { GitContextResult } from '../types';
import { encode } from '@toon-format/toon';

export function formatJson(result: GitContextResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatExplain(result: GitContextResult): string {
  const lines: string[] = [];
  const { analysis, risks, intent } = result;

  // Header
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                     GIT CONTEXT ANALYSIS');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Summary
  lines.push('📊 SUMMARY');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`  Branch comparison: ${analysis.baseBranch} → ${analysis.compareBranch}`);
  lines.push(`  Commits: ${analysis.stats.commitsCount}`);
  lines.push(`  Files changed: ${analysis.stats.filesChanged}`);
  lines.push(`  Lines: +${analysis.stats.totalInsertions} / -${analysis.stats.totalDeletions}`);
  lines.push('');

  // Change Intent
  lines.push('🎯 CHANGE INTENT');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`  Primary theme: ${intent.primaryTheme}`);
  lines.push(`  Confidence: ${intent.confidence.toUpperCase()}`);
  if (intent.keywords.length > 0) {
    lines.push(`  Keywords: ${intent.keywords.join(', ')}`);
  }
  lines.push('');

  if (intent.commitGroups.length > 0) {
    lines.push('  Commit groups:');
    for (const group of intent.commitGroups) {
      lines.push(`    • ${group.theme}: ${group.commits.join(', ')}`);
    }
    lines.push('');
  }

  // Risk Analysis (only when --risk flag is used)
  if (risks) {
    lines.push('⚠️  RISK ANALYSIS');
    lines.push('───────────────────────────────────────────────────────────────');

    // Security
    if (risks.securitySensitive) {
      lines.push('');
      lines.push('  🔐 SECURITY SENSITIVE: YES');
      for (const risk of risks.securityRisks) {
        lines.push(`    • ${risk.file}`);
        for (const reason of risk.reasons) {
          lines.push(`      └─ ${reason}`);
        }
      }
    } else {
      lines.push('  🔐 Security sensitive: No');
    }

    // Data Layer
    if (risks.dataLayerAffected) {
      lines.push('');
      lines.push('  💾 DATA LAYER AFFECTED: YES');
      for (const risk of risks.dataLayerRisks) {
        lines.push(`    • ${risk.file}`);
        if (risk.affectedTables.length > 0) {
          lines.push(`      └─ Tables: ${risk.affectedTables.join(', ')}`);
        }
        if (risk.operations.length > 0) {
          lines.push(`      └─ Operations: ${risk.operations.join(', ')}`);
        }
      }
    } else {
      lines.push('  💾 Data layer affected: No');
    }

    // Dependencies
    if (risks.dependencyChanges.length > 0) {
      lines.push('');
      lines.push('  📦 DEPENDENCY CHANGES');
      for (const dep of risks.dependencyChanges) {
        let label: string;
        switch (dep.type) {
          case 'added':
            label = `✚ Added: ${dep.name}@${dep.newVersion}`;
            break;
          case 'removed':
            label = `✖ Removed: ${dep.name}@${dep.oldVersion}`;
            break;
          case 'upgraded':
            label = `↑ Upgraded: ${dep.name} ${dep.oldVersion} → ${dep.newVersion}`;
            if (dep.versionBumpType) {
              label += ` (${dep.versionBumpType})`;
            }
            break;
          case 'downgraded':
            label = `↓ Downgraded: ${dep.name} ${dep.oldVersion} → ${dep.newVersion}`;
            break;
        }
        lines.push(`    • ${label} [${dep.packageManager}]`);
      }
    } else {
      lines.push('  📦 Dependency changes: None');
    }

    // API Changes
    if (risks.apiChanges.length > 0) {
      lines.push('');
      lines.push('  🔌 API SURFACE CHANGES');
      for (const api of risks.apiChanges) {
        const icon = api.changeType === 'added' ? '✚' : api.changeType === 'removed' ? '✖' : '✎';
        lines.push(`    ${icon} ${api.description}`);
        lines.push(`      └─ ${api.file}`);
      }
    } else {
      lines.push('  🔌 API surface changes: None');
    }

    // Breaking Changes
    if (risks.breakingChanges.length > 0) {
      lines.push('');
      lines.push('  💥 BREAKING CHANGES DETECTED');
      for (const bc of risks.breakingChanges) {
        lines.push(`    • ${bc.description}`);
        lines.push(`      └─ ${bc.file}`);
        if (bc.oldSignature && bc.newSignature) {
          lines.push(`      └─ Before: ${bc.oldSignature}`);
          lines.push(`      └─ After:  ${bc.newSignature}`);
        }
      }
    } else {
      lines.push('  💥 Breaking changes: None detected');
    }

    lines.push('');
  }

  // Commits
  lines.push('📝 COMMITS');
  lines.push('───────────────────────────────────────────────────────────────');
  for (const commit of analysis.commits.slice(0, 20)) {
    const date = new Date(commit.timestamp).toLocaleDateString();
    lines.push(`  ${commit.shortSha} | ${date} | ${commit.author}`);
    lines.push(`         ${commit.message.split('\n')[0].slice(0, 60)}`);
  }
  if (analysis.commits.length > 20) {
    lines.push(`  ... and ${analysis.commits.length - 20} more commits`);
  }
  lines.push('');

  // Files Changed
  lines.push('📁 FILES CHANGED');
  lines.push('───────────────────────────────────────────────────────────────');
  const sortedFiles = [...analysis.fileChanges].sort(
    (a, b) => (b.insertions + b.deletions) - (a.insertions + a.deletions)
  );
  for (const file of sortedFiles.slice(0, 30)) {
    const statusIcon = {
      added: '✚',
      modified: '✎',
      deleted: '✖',
      renamed: '↔',
    }[file.status];
    const stats = `+${file.insertions}/-${file.deletions}`;
    lines.push(`  ${statusIcon} ${file.path} (${stats})`);
    if (file.oldPath) {
      lines.push(`    └─ Renamed from: ${file.oldPath}`);
    }
  }
  if (analysis.fileChanges.length > 30) {
    lines.push(`  ... and ${analysis.fileChanges.length - 30} more files`);
  }
  lines.push('');

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Generated at: ${result.generatedAt}`);
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Token-Oriented Object Notation (TOON) format
 * https://toonformat.dev
 *
 * TOON combines YAML-like indentation with CSV-style tabular arrays
 * for ~40% fewer tokens with better LLM accuracy than JSON.
 */
export function formatToon(result: GitContextResult): string {
  return encode(result);
}
