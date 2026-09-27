/**
 * Vercel serverless function: POST /api/analyze
 * Deterministic contract drift analysis — no LLM, returns DriftReport.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as path from "path";
import { analyze } from "../src/workflow/coordinator";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.status(204).end();
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    res.status(405).json({ status: "error", message: "Method not allowed" });
    return;
  }

  const body = req.body as { baselinePaths?: string[]; currentPaths?: string[] } | undefined;
  const root = process.cwd();

  const baselinePaths = body?.baselinePaths ?? [
    path.join(root, "fixtures/v1/openapi.yaml"),
    path.join(root, "fixtures/v1/user.schema.ts"),
  ];
  const currentPaths = body?.currentPaths ?? [
    path.join(root, "fixtures/v2/openapi.yaml"),
    path.join(root, "fixtures/v2/user.schema.ts"),
  ];

  try {
    const report = await analyze({ baselinePaths, currentPaths });
    res.json({ status: "ok", report });
  } catch (err) {
    res.status(500).json({ status: "error", message: String(err) });
  }
}
