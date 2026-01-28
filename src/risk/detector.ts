import { GitAnalysis, RiskAnalysis } from '../types';
import { detectSecurityRisks } from './security';
import { detectDataLayerRisks } from './data-layer';
import { detectDependencyChanges } from './dependencies';
import { detectApiChanges } from './api';
import { detectBreakingChanges } from './breaking';

export function analyzeRisks(gitAnalysis: GitAnalysis): RiskAnalysis {
  const { fileChanges, diffHunks } = gitAnalysis;

  const securityRisks = detectSecurityRisks(fileChanges, diffHunks);
  const dataLayerRisks = detectDataLayerRisks(fileChanges, diffHunks);
  const dependencyChanges = detectDependencyChanges(diffHunks);
  const apiChanges = detectApiChanges(fileChanges, diffHunks);
  const breakingChanges = detectBreakingChanges(diffHunks);

  return {
    securitySensitive: securityRisks.length > 0,
    securityRisks,
    dataLayerAffected: dataLayerRisks.length > 0,
    dataLayerRisks,
    dependencyChanges,
    apiChanges,
    breakingChanges,
  };
}
