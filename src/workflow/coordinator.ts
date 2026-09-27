/**
 * ContractWeave Workflow Coordinator
 *
 * Chains: analyze → explain → repair → verify → evidence
 *
 * The LLM is involved only in explain, repair, and evidence steps.
 * analyze and verify are deterministic.
 */

import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { ContractGraph } from "../graph/index";
import { parseOpenApi } from "../parsers/openapi";
import { parseZodSchema } from "../parsers/zod";
import { parseJestFile } from "../parsers/jest";
import { diffMeta } from "../drift/differ";
import { scoreChanges } from "../drift/scorer";
import { complete } from "../llm/runtime";
import { createReleaseApproval } from "../mcp/tools/create_release_approval";
import { inferConsumerEdges } from "../mcp/tools/find_contract_consumers";
import type {
  ContractNode,
  DriftFinding,
  DriftReport,
  LLMAnalysis,
  WorkflowResult,
} from "../graph/types";

export interface WorkflowOptions {
  baselinePaths: string[]; // v1 / baseline artifacts
  currentPaths: string[]; // v2 / current artifacts
  snapshotFile?: string; // optional snapshot persistence
}

// ---------------------------------------------------------------------------
// Step 1 — ANALYZE (deterministic)
// ---------------------------------------------------------------------------
export async function analyze(opts: WorkflowOptions): Promise<DriftReport> {
  const runId = crypto.randomBytes(4).toString("hex");
  const graph = new ContractGraph();

  // Parse baseline
  const baselineNodes = parseArtifacts(opts.baselinePaths);
  for (const n of baselineNodes) graph.add(n);

  // Parse current
  const currentNodes = parseArtifacts(opts.currentPaths);
  for (const n of currentNodes) graph.add(n);

  // Infer consumer edges
  inferConsumerEdges(graph);

  // Build a quick baseline digest map (path → node)
  const baselineByPath = new Map(baselineNodes.map((n) => [n.sourcePath, n]));

  const findings: DriftFinding[] = [];
  const scannedPaths: string[] = [];

  for (const current of currentNodes) {
    scannedPaths.push(current.sourcePath);

    // Find matching baseline by filename (compare v1↔v2 by basename)
    const baselinePath = findMatchingBaseline(current.sourcePath, baselineNodes);
    if (!baselinePath) continue;

    const baseline = baselineByPath.get(baselinePath);
    if (!baseline) continue;

    if (baseline.digest === current.digest) continue; // no change

    const changes = diffMeta(baseline.meta, current.meta, "");
    if (changes.length === 0) continue;

    const consumers = graph.getConsumers(current.id).map((n) => n.id);
    findings.push(scoreChanges(current, changes, consumers));
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

function findMatchingBaseline(
  currentPath: string,
  baselineNodes: ContractNode[]
): string | undefined {
  const basename = path.basename(currentPath);
  const match = baselineNodes.find((n) => path.basename(n.sourcePath) === basename);
  return match?.sourcePath;
}

// ---------------------------------------------------------------------------
// Step 2 — EXPLAIN (LLM)
// ---------------------------------------------------------------------------
export async function explain(
  report: DriftReport
): Promise<Record<string, LLMAnalysis>> {
  const explanations: Record<string, LLMAnalysis> = {};

  for (const finding of report.findings) {
    const raw = await complete(EXPLAIN_SYSTEM, buildExplainPrompt(finding));
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

function buildExplainPrompt(finding: DriftFinding): string {
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
export async function repair(
  report: DriftReport,
  currentPaths: string[]
): Promise<Record<string, string>> {
  const repairs: Record<string, string> = {};

  for (const finding of report.findings) {
    if (finding.severity === "INFO") continue; // don't auto-repair INFO

    const node = report.graph.nodes.find((n) => n.id === finding.nodeId);
    if (!node) continue;

    const sourceText = readSource(node.sourcePath);
    if (!sourceText) continue;

    const patch = await complete(REPAIR_SYSTEM, buildRepairPrompt(finding, sourceText));
    repairs[finding.nodeId] = patch.trim();
  }

  return repairs;
}

const REPAIR_SYSTEM = `You are ContractWeave, an expert in API contract repair.
Given a contract drift finding and the current source file, produce ONLY the corrected full file content.
Do not include explanations, markdown fences, or code blocks.
Output ONLY the raw file content that should replace the current file.`;

function buildRepairPrompt(finding: DriftFinding, source: string): string {
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
export async function verify(
  report: DriftReport,
  repairs: Record<string, string>
): Promise<Record<string, boolean>> {
  const verifications: Record<string, boolean> = {};

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
      const residual = diffMeta(node.meta, repaired.meta, "");
      const residualFinding = scoreChanges(repaired, residual, []);
      verifications[nodeId] = residualFinding.severity !== "BREAKING";
    } catch {
      verifications[nodeId] = false;
    }
  }

  return verifications;
}

// ---------------------------------------------------------------------------
// Step 5 — EVIDENCE (assembled from prior steps)
// ---------------------------------------------------------------------------
export async function evidence(
  report: DriftReport,
  explanations: Record<string, LLMAnalysis>,
  repairs: Record<string, string>,
  verifications: Record<string, boolean>
): Promise<WorkflowResult> {
  const workflowResult: WorkflowResult = {
    report,
    explanations,
    repairs,
    verifications,
    evidence: {} as WorkflowResult["evidence"], // filled below
  };

  const { evidence: ev } = createReleaseApproval({
    runId: report.runId,
    workflowResult,
  });

  workflowResult.evidence = ev;
  return workflowResult;
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------
export async function runWorkflow(opts: WorkflowOptions): Promise<WorkflowResult> {
  const report = await analyze(opts);
  const explanations = await explain(report);
  const repairs = await repair(report, opts.currentPaths);
  const verifications = await verify(report, repairs);
  return evidence(report, explanations, repairs, verifications);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseArtifacts(paths: string[]): ContractNode[] {
  const nodes: ContractNode[] = [];
  for (const p of paths) {
    const abs = path.resolve(p);
    try {
      const node = parseArtifactAt(abs, abs);
      if (node) nodes.push(node);
    } catch {
      // skip unparseable files
    }
  }
  return nodes;
}

function parseArtifactAt(tmpPath: string, originalPath: string): ContractNode | null {
  const lower = originalPath.toLowerCase();
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return parseOpenApi(tmpPath);
  }
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
    if (lower.endsWith(".test.ts") || lower.endsWith(".spec.ts")) {
      return parseJestFile(tmpPath);
    }
    return parseZodSchema(tmpPath);
  }
  return null;
}

function readSource(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function parseAnalysisJSON(raw: string, finding: DriftFinding): LLMAnalysis {
  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```[a-z]*\n?/gi, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<LLMAnalysis>;
    return {
      risk: parsed.risk ?? finding.severity,
      explanation: parsed.explanation ?? finding.message,
      affectedContracts: parsed.affectedContracts ?? finding.affectedConsumers,
      remediationRationale: parsed.remediationRationale ?? "Review and address the listed changes.",
    };
  } catch {
    return {
      risk: finding.severity,
      explanation: raw || finding.message,
      affectedContracts: finding.affectedConsumers,
      remediationRationale: "Review and address the listed changes.",
    };
  }
}
