#!/usr/bin/env node
/**
 * ContractWeave CLI
 *
 * Commands:
 *   demo     — runs the two-scene demo (OpenAPI BREAKING + Zod WARNING)
 *   serve    — starts the Orchestrate HTTP skill server
 *   analyze  — analyze contract drift for given paths
 */

import { Command } from "commander";
import * as path from "path";
import { runWorkflow, analyze as analyzeOnly } from "./workflow/coordinator";
import type { WorkflowResult, DriftReport } from "./graph/types";

// ---------------------------------------------------------------------------
// ANSI colors (no external dependency)
// ---------------------------------------------------------------------------
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function color(code: string, text: string): string {
  return `${code}${text}${c.reset}`;
}

function section(title: string): void {
  process.stdout.write(`\n${color(c.bold + c.cyan, `▶ ${title}`)}\n${"─".repeat(60)}\n`);
}

function severityColor(sev: string): string {
  if (sev === "BREAKING") return color(c.red, sev);
  if (sev === "WARNING") return color(c.yellow, sev);
  return color(c.dim, sev);
}

// ---------------------------------------------------------------------------
// Demo command
// ---------------------------------------------------------------------------
async function runDemo(): Promise<void> {
  const root = path.join(__dirname, "..");

  console.log(color(c.bold, "\n🔍 ContractWeave — Contract Integrity Demo\n"));
  console.log("  Scene 1: OpenAPI schema drift (BREAKING — field removed)");
  console.log("  Scene 2: Zod type drift (WARNING — type widened to optional)");
  console.log("");

  // ---------------------------------------------------------------------------
  // Scene 1: OpenAPI
  // ---------------------------------------------------------------------------
  section("SCENE 1 — OpenAPI Contract Drift");
  const openapiResult = await runScene(
    "OpenAPI Users API",
    [path.join(root, "fixtures/v1/openapi.yaml")],
    [path.join(root, "fixtures/v2/openapi.yaml")]
  );
  printResult(openapiResult);

  // ---------------------------------------------------------------------------
  // Scene 2: Zod Schema
  // ---------------------------------------------------------------------------
  section("SCENE 2 — Zod Schema Type Drift");
  const zodResult = await runScene(
    "Zod UserSchema",
    [path.join(root, "fixtures/v1/user.schema.ts")],
    [path.join(root, "fixtures/v2/user.schema.ts")]
  );
  printResult(zodResult);

  // ---------------------------------------------------------------------------
  // Combined evidence
  // ---------------------------------------------------------------------------
  section("COMBINED RELEASE EVIDENCE");
  const totalBreaking =
    (openapiResult.report.findings.filter((f) => f.severity === "BREAKING").length) +
    (zodResult.report.findings.filter((f) => f.severity === "BREAKING").length);
  const totalWarning =
    (openapiResult.report.findings.filter((f) => f.severity === "WARNING").length) +
    (zodResult.report.findings.filter((f) => f.severity === "WARNING").length);

  const passed = totalBreaking === 0;

  console.log(`  Badge: ${passed ? color(c.green, "✅ contracts: verified") : color(c.red, "❌ contracts: " + totalBreaking + " breaking")}`);
  console.log(`  Breaking: ${color(c.red, String(totalBreaking))}  Warnings: ${color(c.yellow, String(totalWarning))}`);

  if (openapiResult.evidence?.approvalToken) {
    console.log(`  Approval token (scene 1): ${color(c.dim, openapiResult.evidence.approvalToken)}`);
  }
  if (zodResult.evidence?.approvalToken) {
    console.log(`  Approval token (scene 2): ${color(c.dim, zodResult.evidence.approvalToken)}`);
  }

  console.log(color(c.bold, "\n✔ Demo complete.\n"));
}

interface SceneResult {
  report: DriftReport;
  evidence: { approvalToken: string } | null;
  result: WorkflowResult | null;
}

async function runScene(
  label: string,
  baselinePaths: string[],
  currentPaths: string[]
): Promise<SceneResult> {
  console.log(color(c.bold, `\n  Artifact: ${label}`));
  console.log(`  Baseline: ${baselinePaths.map((p) => path.basename(p)).join(", ")}`);
  console.log(`  Current:  ${currentPaths.map((p) => path.basename(p)).join(", ")}`);

  section("  1/5 ANALYZE");
  let result: WorkflowResult | null = null;
  let report: DriftReport;

  try {
    result = await runWorkflow({ baselinePaths, currentPaths });
    report = result.report;
  } catch (err) {
    // If LLM unavailable, fall back to analyze-only
    console.log(`  ${color(c.yellow, "LLM unavailable")} — running deterministic analysis only`);
    console.log(`  ${color(c.dim, String(err))}`);
    report = await analyzeOnly({ baselinePaths, currentPaths });
  }

  if (report.findings.length === 0) {
    console.log(`  ${color(c.green, "✓ No drift detected")}`);
    return { report, evidence: null, result };
  }

  for (const f of report.findings) {
    console.log(`  ${severityColor(f.severity)} — ${f.message}`);
    for (const ch of f.changes.slice(0, 5)) {
      console.log(`    ${color(c.dim, ch.kind.padEnd(14))} ${ch.path}`);
    }
  }

  if (result) {
    section("  2/5 EXPLAIN");
    for (const [nodeId, analysis] of Object.entries(result.explanations)) {
      console.log(`  Node: ${color(c.dim, nodeId)}`);
      console.log(`  Risk: ${severityColor(analysis.risk)}`);
      console.log(`  ${analysis.explanation}`);
      console.log(`  Remediation: ${color(c.dim, analysis.remediationRationale)}`);
    }

    section("  3/5 REPAIR");
    const repairCount = Object.keys(result.repairs).length;
    if (repairCount === 0) {
      console.log(`  No repairs generated (INFO-only findings)`);
    } else {
      console.log(`  ${repairCount} repair(s) generated`);
    }

    section("  4/5 VERIFY");
    for (const [nodeId, verified] of Object.entries(result.verifications)) {
      console.log(`  ${verified ? color(c.green, "✓ CLEAN") : color(c.red, "✗ RESIDUAL DRIFT")} — ${nodeId}`);
    }

    section("  5/5 EVIDENCE");
    const ev = result.evidence;
    console.log(`  Badge: ${ev.badge.label}: ${ev.passed ? color(c.green, ev.badge.message) : color(c.red, ev.badge.message)}`);
    console.log(`  SBOM entries: ${ev.sbom.length}`);
    console.log(`  Patch summary: ${ev.patchSummary}`);

    return {
      report,
      evidence: { approvalToken: "" },
      result,
    };
  }

  return { report, evidence: null, result };
}

function printResult(scene: SceneResult): void {
  const breaking = scene.report.findings.filter((f) => f.severity === "BREAKING").length;
  const warning = scene.report.findings.filter((f) => f.severity === "WARNING").length;
  console.log(`\n  Summary: ${color(c.red, breaking + " BREAKING")}  ${color(c.yellow, warning + " WARNING")}`);
}

// ---------------------------------------------------------------------------
// analyze command (standalone)
// ---------------------------------------------------------------------------
async function runAnalyze(baselinePaths: string[], currentPaths: string[]): Promise<void> {
  section("ANALYZE");
  const report = await analyzeOnly({ baselinePaths, currentPaths });

  if (report.clean) {
    console.log(color(c.green, "  ✓ All contracts clean — no drift detected"));
    return;
  }

  for (const f of report.findings) {
    console.log(`  ${severityColor(f.severity)} ${f.message}`);
    for (const ch of f.changes) {
      console.log(`    ${color(c.dim, ch.kind.padEnd(14))} ${ch.path}`);
    }
  }

  console.log(`\n  Total: ${report.findings.length} finding(s)\n`);
  if (report.findings.some((f) => f.severity === "BREAKING")) {
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// serve command — starts Orchestrate skill HTTP server
// ---------------------------------------------------------------------------
async function runServe(port: number): Promise<void> {
  const { createSkillServer } = await import("./orchestrate/skill");
  const app = createSkillServer();
  app.listen(port, () => {
    console.log(color(c.green, `\n  ContractWeave Orchestrate skill listening on http://localhost:${port}`));
    console.log(`  POST /orchestrate/run-workflow\n`);
  });
}

// ---------------------------------------------------------------------------
// CLI wiring
// ---------------------------------------------------------------------------
const program = new Command();
program
  .name("contractweave")
  .description("Semantic contract integrity for TypeScript/Node.js projects")
  .version("0.1.0");

program
  .command("demo")
  .description("Run the two-scene hackathon demo (OpenAPI + Zod drift)")
  .action(() => runDemo().catch((err) => { console.error(err); process.exit(1); }));

program
  .command("analyze")
  .description("Analyze drift between baseline and current artifact paths")
  .requiredOption("--baseline <paths...>", "Baseline artifact paths (v1)")
  .requiredOption("--current <paths...>", "Current artifact paths (v2)")
  .action((opts) =>
    runAnalyze(opts.baseline, opts.current).catch((err) => { console.error(err); process.exit(1); })
  );

program
  .command("serve")
  .description("Start the Orchestrate HTTP skill server")
  .option("--port <port>", "Port to listen on", "3333")
  .action((opts) =>
    runServe(Number(opts.port)).catch((err) => { console.error(err); process.exit(1); })
  );

program.parse(process.argv);
