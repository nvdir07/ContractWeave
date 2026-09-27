#!/usr/bin/env node
"use strict";
/**
 * ContractWeave CLI
 *
 * Commands:
 *   demo     — runs the two-scene demo (OpenAPI BREAKING + Zod WARNING)
 *   serve    — starts the Orchestrate HTTP skill server
 *   analyze  — analyze contract drift for given paths
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
const commander_1 = require("commander");
const path = __importStar(require("path"));
const coordinator_1 = require("./workflow/coordinator");
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
function color(code, text) {
    return `${code}${text}${c.reset}`;
}
function section(title) {
    process.stdout.write(`\n${color(c.bold + c.cyan, `▶ ${title}`)}\n${"─".repeat(60)}\n`);
}
function severityColor(sev) {
    if (sev === "BREAKING")
        return color(c.red, sev);
    if (sev === "WARNING")
        return color(c.yellow, sev);
    return color(c.dim, sev);
}
// ---------------------------------------------------------------------------
// Demo command
// ---------------------------------------------------------------------------
async function runDemo() {
    const root = path.join(__dirname, "..");
    console.log(color(c.bold, "\n🔍 ContractWeave — Contract Integrity Demo\n"));
    console.log("  Scene 1: OpenAPI schema drift (BREAKING — field removed)");
    console.log("  Scene 2: Zod type drift (WARNING — type widened to optional)");
    console.log("");
    // ---------------------------------------------------------------------------
    // Scene 1: OpenAPI
    // ---------------------------------------------------------------------------
    section("SCENE 1 — OpenAPI Contract Drift");
    const openapiResult = await runScene("OpenAPI Users API", [path.join(root, "fixtures/v1/openapi.yaml")], [path.join(root, "fixtures/v2/openapi.yaml")]);
    printResult(openapiResult);
    // ---------------------------------------------------------------------------
    // Scene 2: Zod Schema
    // ---------------------------------------------------------------------------
    section("SCENE 2 — Zod Schema Type Drift");
    const zodResult = await runScene("Zod UserSchema", [path.join(root, "fixtures/v1/user.schema.ts")], [path.join(root, "fixtures/v2/user.schema.ts")]);
    printResult(zodResult);
    // ---------------------------------------------------------------------------
    // Combined evidence
    // ---------------------------------------------------------------------------
    section("COMBINED RELEASE EVIDENCE");
    const totalBreaking = (openapiResult.report.findings.filter((f) => f.severity === "BREAKING").length) +
        (zodResult.report.findings.filter((f) => f.severity === "BREAKING").length);
    const totalWarning = (openapiResult.report.findings.filter((f) => f.severity === "WARNING").length) +
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
async function runScene(label, baselinePaths, currentPaths) {
    console.log(color(c.bold, `\n  Artifact: ${label}`));
    console.log(`  Baseline: ${baselinePaths.map((p) => path.basename(p)).join(", ")}`);
    console.log(`  Current:  ${currentPaths.map((p) => path.basename(p)).join(", ")}`);
    section("  1/5 ANALYZE");
    let result = null;
    let report;
    try {
        result = await (0, coordinator_1.runWorkflow)({ baselinePaths, currentPaths });
        report = result.report;
    }
    catch (err) {
        // If LLM unavailable, fall back to analyze-only
        console.log(`  ${color(c.yellow, "LLM unavailable")} — running deterministic analysis only`);
        console.log(`  ${color(c.dim, String(err))}`);
        report = await (0, coordinator_1.analyze)({ baselinePaths, currentPaths });
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
        }
        else {
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
function printResult(scene) {
    const breaking = scene.report.findings.filter((f) => f.severity === "BREAKING").length;
    const warning = scene.report.findings.filter((f) => f.severity === "WARNING").length;
    console.log(`\n  Summary: ${color(c.red, breaking + " BREAKING")}  ${color(c.yellow, warning + " WARNING")}`);
}
// ---------------------------------------------------------------------------
// analyze command (standalone)
// ---------------------------------------------------------------------------
async function runAnalyze(baselinePaths, currentPaths) {
    section("ANALYZE");
    const report = await (0, coordinator_1.analyze)({ baselinePaths, currentPaths });
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
async function runServe(port) {
    const { createSkillServer } = await Promise.resolve().then(() => __importStar(require("./orchestrate/skill")));
    const app = createSkillServer();
    app.listen(port, () => {
        console.log(color(c.green, `\n  ContractWeave Orchestrate skill listening on http://localhost:${port}`));
        console.log(`  POST /orchestrate/run-workflow\n`);
    });
}
// ---------------------------------------------------------------------------
// CLI wiring
// ---------------------------------------------------------------------------
const program = new commander_1.Command();
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
    .action((opts) => runAnalyze(opts.baseline, opts.current).catch((err) => { console.error(err); process.exit(1); }));
program
    .command("serve")
    .description("Start the Orchestrate HTTP skill server")
    .option("--port <port>", "Port to listen on", "3333")
    .action((opts) => runServe(Number(opts.port)).catch((err) => { console.error(err); process.exit(1); }));
program.parse(process.argv);
//# sourceMappingURL=cli.js.map