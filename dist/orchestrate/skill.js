"use strict";
/**
 * ContractWeave — watsonx Orchestrate Skill Server
 *
 * Routes:
 *   POST /orchestrate/run-workflow — Orchestrate skill endpoint (original)
 *   POST /api/run-workflow         — Dashboard endpoint (full workflow + approvalToken)
 *   POST /api/analyze              — Dashboard fast path (deterministic, no LLM)
 *   GET  /health                   — Health check
 *
 * No auth for local demo.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSkillServer = createSkillServer;
const express_1 = __importDefault(require("express"));
const path = __importStar(require("path"));
const coordinator_1 = require("../workflow/coordinator");
const create_release_approval_1 = require("../mcp/tools/create_release_approval");
function createSkillServer() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // CORS — allows the Vite dev server (localhost:5173) to call this API.
    // Safe for local demo; no credentials are exposed.
    app.use((_req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Content-Type");
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        next();
    });
    app.options("*", (_req, res) => res.sendStatus(204));
    // ---------------------------------------------------------------------------
    // POST /api/run-workflow — full workflow + approvalToken (dashboard)
    // ---------------------------------------------------------------------------
    app.post("/api/run-workflow", async (req, res) => {
        const body = req.body;
        const root = path.join(__dirname, "../..");
        const baselinePaths = body.baselinePaths ?? [
            path.join(root, "fixtures/v1/openapi.yaml"),
            path.join(root, "fixtures/v1/user.schema.ts"),
        ];
        const currentPaths = body.currentPaths ?? [
            path.join(root, "fixtures/v2/openapi.yaml"),
            path.join(root, "fixtures/v2/user.schema.ts"),
        ];
        try {
            const workflowResult = await (0, coordinator_1.runWorkflow)({ baselinePaths, currentPaths });
            // Merge approvalToken into response so the dashboard can display it
            const approval = (0, create_release_approval_1.createReleaseApproval)({
                runId: workflowResult.report.runId,
                workflowResult,
            });
            res.json({
                status: "ok",
                result: {
                    ...workflowResult,
                    approvalToken: approval.approvalToken,
                    summaryMarkdown: approval.summaryMarkdown,
                },
            });
        }
        catch (err) {
            // LLM unavailable — fall back to deterministic analyze-only
            try {
                const report = await (0, coordinator_1.analyze)({ baselinePaths, currentPaths });
                const partialResult = {
                    report,
                    explanations: {},
                    repairs: {},
                    verifications: {},
                    evidence: report.clean
                        ? { runId: report.runId, timestamp: report.timestamp, passed: true,
                            badge: { schemaVersion: 1, label: "contracts", message: "verified", color: "brightgreen" },
                            sbom: [], patchSummary: "No repairs needed.", breakingCount: 0, warningCount: 0 }
                        : { runId: report.runId, timestamp: report.timestamp, passed: false,
                            badge: { schemaVersion: 1, label: "contracts", message: "analyze-only", color: "yellow" },
                            sbom: [], patchSummary: "LLM unavailable — analysis only.", breakingCount: report.findings.filter(f => f.severity === "BREAKING").length, warningCount: report.findings.filter(f => f.severity === "WARNING").length },
                };
                res.json({ status: "partial", llmError: String(err), result: partialResult });
            }
            catch (analyzeErr) {
                res.status(500).json({ status: "error", message: String(analyzeErr) });
            }
        }
    });
    // ---------------------------------------------------------------------------
    // POST /api/analyze — deterministic analyze only, no LLM (dashboard fast path)
    // ---------------------------------------------------------------------------
    app.post("/api/analyze", async (req, res) => {
        const body = req.body;
        const root = path.join(__dirname, "../..");
        const baselinePaths = body.baselinePaths ?? [
            path.join(root, "fixtures/v1/openapi.yaml"),
            path.join(root, "fixtures/v1/user.schema.ts"),
        ];
        const currentPaths = body.currentPaths ?? [
            path.join(root, "fixtures/v2/openapi.yaml"),
            path.join(root, "fixtures/v2/user.schema.ts"),
        ];
        try {
            const report = await (0, coordinator_1.analyze)({ baselinePaths, currentPaths });
            res.json({ status: "ok", report });
        }
        catch (err) {
            res.status(500).json({ status: "error", message: String(err) });
        }
    });
    // ---------------------------------------------------------------------------
    // POST /orchestrate/run-workflow — original Orchestrate skill (unchanged)
    // ---------------------------------------------------------------------------
    app.post("/orchestrate/run-workflow", async (req, res) => {
        const body = req.body;
        // Extract paths: explicit fields take priority, else parse from request text
        let baselinePaths = body.baselinePaths ?? [];
        let currentPaths = body.currentPaths ?? [];
        if (baselinePaths.length === 0 || currentPaths.length === 0) {
            const extracted = extractPaths(body.request ?? "");
            if (baselinePaths.length === 0)
                baselinePaths = extracted.baseline;
            if (currentPaths.length === 0)
                currentPaths = extracted.current;
        }
        if (baselinePaths.length === 0 || currentPaths.length === 0) {
            // Default to demo fixtures if nothing parseable
            const root = path.join(__dirname, "../..");
            baselinePaths = [
                path.join(root, "fixtures/v1/openapi.yaml"),
                path.join(root, "fixtures/v1/user.schema.ts"),
            ];
            currentPaths = [
                path.join(root, "fixtures/v2/openapi.yaml"),
                path.join(root, "fixtures/v2/user.schema.ts"),
            ];
        }
        try {
            const result = await (0, coordinator_1.runWorkflow)({ baselinePaths, currentPaths });
            res.json({ status: "ok", result });
        }
        catch (err) {
            res.status(500).json({ status: "error", message: String(err) });
        }
    });
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", service: "contractweave-skill" });
    });
    return app;
}
/**
 * Very lightweight path extractor from natural language.
 * Looks for v1/v2 directory references or explicit file paths.
 */
function extractPaths(text) {
    const baseline = [];
    const current = [];
    // Match quoted or unquoted file paths ending in .yaml .ts .json
    const pathRe = /['"]?([\w./\\-]+\.(?:yaml|yml|ts|json))['"]?/gi;
    const allPaths = [];
    let m;
    while ((m = pathRe.exec(text)) !== null) {
        allPaths.push(path.resolve(m[1]));
    }
    for (const p of allPaths) {
        if (p.includes("/v1/") || p.includes("\\v1\\") || p.includes("baseline")) {
            baseline.push(p);
        }
        else if (p.includes("/v2/") || p.includes("\\v2\\") || p.includes("current")) {
            current.push(p);
        }
    }
    return { baseline, current };
}
//# sourceMappingURL=skill.js.map