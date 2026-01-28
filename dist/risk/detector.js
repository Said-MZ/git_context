"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeRisks = analyzeRisks;
const security_1 = require("./security");
const data_layer_1 = require("./data-layer");
const dependencies_1 = require("./dependencies");
const api_1 = require("./api");
const breaking_1 = require("./breaking");
function analyzeRisks(gitAnalysis) {
    const { fileChanges, diffHunks } = gitAnalysis;
    const securityRisks = (0, security_1.detectSecurityRisks)(fileChanges, diffHunks);
    const dataLayerRisks = (0, data_layer_1.detectDataLayerRisks)(fileChanges, diffHunks);
    const dependencyChanges = (0, dependencies_1.detectDependencyChanges)(diffHunks);
    const apiChanges = (0, api_1.detectApiChanges)(fileChanges, diffHunks);
    const breakingChanges = (0, breaking_1.detectBreakingChanges)(diffHunks);
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
//# sourceMappingURL=detector.js.map