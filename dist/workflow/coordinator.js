"use strict";
/**
 * ContractWeave Workflow Coordinator
 *
 * Chains: analyze → explain → repair → verify → evidence
 *
 * The LLM is involved only in explain, repair, and evidence steps.
 * analyze and verify are deterministic.
 */
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
exports.analyze = analyze;
exports.explain = explain;
exports.repair = repair;
exports.verify = verify;
exports.evidence = evidence;
exports.runWorkflow = runWorkflow;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const index_1 = require("../graph/index");
const openapi_1 = require("../parsers/openapi");
const zod_1 = require("../parsers/zod");
const jest_1 = require("../parsers/jest");
const differ_1 = require("../drift/differ");
const scorer_1 = require("../drift/scorer");
const runtime_1 = require("../llm/runtime");
const create_release_approval_1 = require("../mcp/tools/create_release_approval");
const find_contract_consumers_1 = require("../mcp/tools/find_contract_consumers");
// ---------------------------------------------------------------------------
// Step 1 — ANALYZE (deterministic)
// ---------------------------------------------------------------------------
async function analyze(opts) {
    const runId = crypto.randomBytes(4).toString("hex");
    const graph = new index_1.ContractGraph();
    // Parse baseline
    const baselineNodes = parseArtifacts(opts.baselinePaths);
    for (const n of baselineNodes)
        graph.add(n);
    // Parse current
    const currentNodes = parseArtifacts(opts.currentPaths);
    for (const n of currentNodes)
        graph.add(n);
    // Infer consumer edges
    (0, find_contract_consumers_1.inferConsumerEdges)(graph);
    // Build a quick baseline digest map (path → node)
    const baselineByPath = new Map(baselineNodes.map((n) => [n.sourcePath, n]));
    const findings = [];
    const scannedPaths = [];
    for (const current of currentNodes) {
        scannedPaths.push(current.sourcePath);
        // Find matching baseline by filename (compare v1↔v2 by basename)
        const baselinePath = findMatchingBaseline(current.sourcePath, baselineNodes);
        if (!baselinePath)
            continue;
        const baseline = baselineByPath.get(baselinePath);
        if (!baseline)
            continue;
        if (baseline.digest === current.digest)
            continue; // no change
        const changes = (0, differ_1.diffMeta)(baseline.meta, current.meta, "");
        if (changes.length === 0)
            continue;
        const consumers = graph.getConsumers(current.id).map((n) => n.id);
        findings.push((0, scorer_1.scoreChanges)(current, changes, consumers));
    }
    return {
        runId,
        timestamp: new Date().toISOString(),
        findings,
        scannedPaths,
        graph: graph.toJSON(),
        clean: findings.length === 0,
    };
}
function findMatchingBaseline(currentPath, baselineNodes) {
    const basename = path.basename(currentPath);
    const match = baselineNodes.find((n) => path.basename(n.sourcePath) === basename);
    return match?.sourcePath;
}
// ---------------------------------------------------------------------------
// Step 2 — EXPLAIN (LLM)
// ---------------------------------------------------------------------------
async function explain(report) {
    const explanations = {};
    for (const finding of report.findings) {
        const raw = await (0, runtime_1.complete)(EXPLAIN_SYSTEM, buildExplainPrompt(finding));
        explanations[finding.nodeId] = parseAnalysisJSON(raw, finding);
    }
    return explanations;
}
const EXPLAIN_SYSTEM = `You are ContractWeave, an expert in API contract analysis.
Given a contract drift finding, produce a JSON object with:
{
  "risk": "BREAKING" | "WARNING" | "INFO",
  "explanation": "clear explanation of what changed and why it matters",
  "affectedContracts": ["list of affected contract node ids"],
  "remediationRationale": "specific recommendation for how to fix or accept this change"
}
Respond ONLY with the JSON object. No prose, no markdown fences.`;
function buildExplainPrompt(finding) {
    return `Contract drift detected in ${finding.nodeKind} at ${finding.nodePath}

Severity: ${finding.severity}
Message: ${finding.message}

Changes:
${finding.changes.map((c) => `  ${c.kind.toUpperCase()} ${c.path}: ${JSON.stringify(c.oldVal)} → ${JSON.stringify(c.newVal)}`).join("\n")}

Affected consumers: ${finding.affectedConsumers.join(", ") || "none identified"}

Produce the JSON analysis.`;
}
// ---------------------------------------------------------------------------
// Step 3 — REPAIR (LLM)
// ---------------------------------------------------------------------------
async function repair(report, currentPaths) {
    const repairs = {};
    for (const finding of report.findings) {
        if (finding.severity === "INFO")
            continue; // don't auto-repair INFO
        const node = report.graph.nodes.find((n) => n.id === finding.nodeId);
        if (!node)
            continue;
        const sourceText = readSource(node.sourcePath);
        if (!sourceText)
            continue;
        const patch = await (0, runtime_1.complete)(REPAIR_SYSTEM, buildRepairPrompt(finding, sourceText));
        repairs[finding.nodeId] = patch.trim();
    }
    return repairs;
}
const REPAIR_SYSTEM = `You are ContractWeave, an expert in API contract repair.
Given a contract drift finding and the current source file, produce ONLY the corrected full file content.
Do not include explanations, markdown fences, or code blocks.
Output ONLY the raw file content that should replace the current file.`;
function buildRepairPrompt(finding, source) {
    return `Contract drift in ${finding.nodeKind} at ${finding.nodePath}

Severity: ${finding.severity}
Issue: ${finding.message}

Changes to address:
${finding.changes.map((c) => `  ${c.kind.toUpperCase()} ${c.path}`).join("\n")}

Current file content:
${source}

Produce the corrected file content.`;
}
// ---------------------------------------------------------------------------
// Step 4 — VERIFY (deterministic re-parse)
// ---------------------------------------------------------------------------
async function verify(report, repairs) {
    const verifications = {};
    for (const [nodeId, patch] of Object.entries(repairs)) {
        const node = report.graph.nodes.find((n) => n.id === nodeId);
        if (!node) {
            verifications[nodeId] = false;
            continue;
        }
        try {
            // Write patch to a temp location and re-parse
            const tmpPath = node.sourcePath + ".tmp";
            fs.writeFileSync(tmpPath, patch, "utf-8");
            const repaired = parseArtifactAt(tmpPath, node.sourcePath);
            fs.unlinkSync(tmpPath);
            if (!repaired) {
                verifications[nodeId] = false;
                continue;
            }
            // Re-diff: find original baseline to compare against
            const baselineFinding = report.findings.find((f) => f.nodeId === nodeId);
            if (!baselineFinding) {
                verifications[nodeId] = true;
                continue;
            }
            // Re-diff repaired against original node meta
            // If no BREAKING changes remain → verified
            const residual = (0, differ_1.diffMeta)(node.meta, repaired.meta, "");
            const residualFinding = (0, scorer_1.scoreChanges)(repaired, residual, []);
            verifications[nodeId] = residualFinding.severity !== "BREAKING";
        }
        catch {
            verifications[nodeId] = false;
        }
    }
    return verifications;
}
// ---------------------------------------------------------------------------
// Step 5 — EVIDENCE (assembled from prior steps)
// ---------------------------------------------------------------------------
async function evidence(report, explanations, repairs, verifications) {
    const workflowResult = {
        report,
        explanations,
        repairs,
        verifications,
        evidence: {}, // filled below
    };
    const { evidence: ev } = (0, create_release_approval_1.createReleaseApproval)({
        runId: report.runId,
        workflowResult,
    });
    workflowResult.evidence = ev;
    return workflowResult;
}
// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------
async function runWorkflow(opts) {
    const report = await analyze(opts);
    const explanations = await explain(report);
    const repairs = await repair(report, opts.currentPaths);
    const verifications = await verify(report, repairs);
    return evidence(report, explanations, repairs, verifications);
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseArtifacts(paths) {
    const nodes = [];
    for (const p of paths) {
        const abs = path.resolve(p);
        try {
            const node = parseArtifactAt(abs, abs);
            if (node)
                nodes.push(node);
        }
        catch {
            // skip unparseable files
        }
    }
    return nodes;
}
function parseArtifactAt(tmpPath, originalPath) {
    const lower = originalPath.toLowerCase();
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
        return (0, openapi_1.parseOpenApi)(tmpPath);
    }
    if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
        if (lower.endsWith(".test.ts") || lower.endsWith(".spec.ts")) {
            return (0, jest_1.parseJestFile)(tmpPath);
        }
        return (0, zod_1.parseZodSchema)(tmpPath);
    }
    return null;
}
function readSource(filePath) {
    try {
        return fs.readFileSync(filePath, "utf-8");
    }
    catch {
        return null;
    }
}
function parseAnalysisJSON(raw, finding) {
    try {
        // Strip any accidental markdown fences
        const cleaned = raw.replace(/```[a-z]*\n?/gi, "").trim();
        const parsed = JSON.parse(cleaned);
        return {
            risk: parsed.risk ?? finding.severity,
            explanation: parsed.explanation ?? finding.message,
            affectedContracts: parsed.affectedContracts ?? finding.affectedConsumers,
            remediationRationale: parsed.remediationRationale ?? "Review and address the listed changes.",
        };
    }
    catch {
        return {
            risk: finding.severity,
            explanation: raw || finding.message,
            affectedContracts: finding.affectedConsumers,
            remediationRationale: "Review and address the listed changes.",
        };
    }
}
//# sourceMappingURL=coordinator.js.map