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

import express, { Request, Response } from "express";
import * as path from "path";
import { runWorkflow, analyze } from "../workflow/coordinator";
import { createReleaseApproval } from "../mcp/tools/create_release_approval";

interface RunWorkflowBody {
  request?: string;
  baselinePaths?: string[];
  currentPaths?: string[];
}

export function createSkillServer(): express.Application {
  const app = express();
  app.use(express.json());

  // CORS — allows the Vite dev server (localhost:5173) to call this API.
  // Safe for local demo; no credentials are exposed.
  app.use((_req: Request, res: Response, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    next();
  });
  app.options("*", (_req: Request, res: Response) => res.sendStatus(204));

  // ---------------------------------------------------------------------------
  // POST /api/run-workflow — full workflow + approvalToken (dashboard)
  // ---------------------------------------------------------------------------
  app.post("/api/run-workflow", async (req: Request, res: Response) => {
    const body = req.body as { baselinePaths?: string[]; currentPaths?: string[] };
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
      const workflowResult = await runWorkflow({ baselinePaths, currentPaths });
      // Merge approvalToken into response so the dashboard can display it
      const approval = createReleaseApproval({
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
    } catch (err) {
      // LLM unavailable — fall back to deterministic analyze-only
      try {
        const report = await analyze({ baselinePaths, currentPaths });
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
      } catch (analyzeErr) {
        res.status(500).json({ status: "error", message: String(analyzeErr) });
      }
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/analyze — deterministic analyze only, no LLM (dashboard fast path)
  // ---------------------------------------------------------------------------
  app.post("/api/analyze", async (req: Request, res: Response) => {
    const body = req.body as { baselinePaths?: string[]; currentPaths?: string[] };
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
      const report = await analyze({ baselinePaths, currentPaths });
      res.json({ status: "ok", report });
    } catch (err) {
      res.status(500).json({ status: "error", message: String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /orchestrate/run-workflow — original Orchestrate skill (unchanged)
  // ---------------------------------------------------------------------------
  app.post("/orchestrate/run-workflow", async (req: Request, res: Response) => {
    const body = req.body as RunWorkflowBody;

    // Extract paths: explicit fields take priority, else parse from request text
    let baselinePaths: string[] = body.baselinePaths ?? [];
    let currentPaths: string[] = body.currentPaths ?? [];

    if (baselinePaths.length === 0 || currentPaths.length === 0) {
      const extracted = extractPaths(body.request ?? "");
      if (baselinePaths.length === 0) baselinePaths = extracted.baseline;
      if (currentPaths.length === 0) currentPaths = extracted.current;
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
      const result = await runWorkflow({ baselinePaths, currentPaths });
      res.json({ status: "ok", result });
    } catch (err) {
      res.status(500).json({ status: "error", message: String(err) });
    }
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "contractweave-skill" });
  });

  return app;
}

/**
 * Very lightweight path extractor from natural language.
 * Looks for v1/v2 directory references or explicit file paths.
 */
function extractPaths(text: string): { baseline: string[]; current: string[] } {
  const baseline: string[] = [];
  const current: string[] = [];

  // Match quoted or unquoted file paths ending in .yaml .ts .json
  const pathRe = /['"]?([\w./\\-]+\.(?:yaml|yml|ts|json))['"]?/gi;
  const allPaths: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(text)) !== null) {
    allPaths.push(path.resolve(m[1]));
  }

  for (const p of allPaths) {
    if (p.includes("/v1/") || p.includes("\\v1\\") || p.includes("baseline")) {
      baseline.push(p);
    } else if (p.includes("/v2/") || p.includes("\\v2\\") || p.includes("current")) {
      current.push(p);
    }
  }

  return { baseline, current };
}
