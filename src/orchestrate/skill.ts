/**
 * ContractWeave — watsonx Orchestrate Skill Server
 *
 * Single Express route: POST /orchestrate/run-workflow
 * Accepts a natural-language request, extracts artifact paths, runs the full workflow.
 *
 * This is the HTTP boundary for Orchestrate skill import.
 * No auth for local demo.
 */

import express, { Request, Response } from "express";
import * as path from "path";
import { runWorkflow } from "../workflow/coordinator";

interface RunWorkflowBody {
  request?: string;
  baselinePaths?: string[];
  currentPaths?: string[];
}

export function createSkillServer(): express.Application {
  const app = express();
  app.use(express.json());

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
