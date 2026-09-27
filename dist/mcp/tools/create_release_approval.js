"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReleaseApproval = createReleaseApproval;
const crypto = __importStar(require("crypto"));
/**
 * create_release_approval — assembles final release evidence from a WorkflowResult.
 * Produces a badge, SBOM, and approval token. Pure computation, no I/O.
 */
function createReleaseApproval(input) {
    const { workflowResult } = input;
    const { report, verifications } = workflowResult;
    const breakingCount = report.findings.filter((f) => f.severity === "BREAKING").length;
    const warningCount = report.findings.filter((f) => f.severity === "WARNING").length;
    // A run passes only when:
    //   1. No BREAKING findings remain, AND
    //   2. Every finding that went through repair was verified clean.
    // NOTE: Object.values({}).every(Boolean) === true (vacuous truth), so we
    // explicitly require breakingCount === 0 as the primary gate.
    const hasUnverifiedFindings = report.findings
        .filter((f) => f.severity === "BREAKING" || f.severity === "WARNING")
        .some((f) => verifications[f.nodeId] === false);
    const passed = breakingCount === 0 &&
        !hasUnverifiedFindings;
    const badge = {
        schemaVersion: 1,
        label: "contracts",
        message: passed
            ? "verified"
            : `${breakingCount} breaking`,
        color: passed ? "brightgreen" : breakingCount > 0 ? "red" : "yellow",
    };
    const sbom = report.graph.nodes.map((node) => {
        const finding = report.findings.find((f) => f.nodeId === node.id);
        const verified = finding ? (verifications[node.id] ?? false) : true;
        return {
            nodeId: node.id,
            sourcePath: node.sourcePath,
            kind: node.kind,
            digest: node.digest,
            verified,
            severity: (finding?.severity ?? "CLEAN"),
        };
    });
    const repairCount = Object.keys(workflowResult.repairs).length;
    const patchSummary = repairCount > 0
        ? `${repairCount} artifact(s) repaired; ${Object.values(verifications).filter(Boolean).length} verified clean.`
        : "No repairs needed.";
    const evidence = {
        runId: input.runId || report.runId,
        timestamp: report.timestamp,
        passed,
        badge,
        sbom,
        patchSummary,
        breakingCount,
        warningCount,
    };
    const approvalToken = crypto
        .createHash("sha256")
        .update(evidence.runId + (passed ? "PASS" : "FAIL"))
        .digest("hex")
        .slice(0, 12);
    const summaryMarkdown = buildMarkdown(evidence, report.findings.length);
    return { evidence, approvalToken, summaryMarkdown };
}
function buildMarkdown(ev, totalFindings) {
    const status = ev.passed ? "✅ PASSED" : "❌ FAILED";
    const lines = [
        `## ContractWeave Release Evidence`,
        ``,
        `**Status**: ${status}  `,
        `**Run ID**: \`${ev.runId}\`  `,
        `**Timestamp**: ${ev.timestamp}  `,
        ``,
        `| Metric | Value |`,
        `|---|---|`,
        `| Total findings | ${totalFindings} |`,
        `| Breaking | ${ev.breakingCount} |`,
        `| Warnings | ${ev.warningCount} |`,
        `| Artifacts in SBOM | ${ev.sbom.length} |`,
        ``,
        `**Patch summary**: ${ev.patchSummary}`,
        ``,
        `![badge](https://img.shields.io/badge/${encodeURIComponent(ev.badge.label)}-${encodeURIComponent(ev.badge.message)}-${ev.badge.color})`,
    ];
    return lines.join("\n");
}
//# sourceMappingURL=create_release_approval.js.map