/**
 * Vercel serverless function: POST /api/run-workflow
 * Full analyze → explain → repair → verify → evidence pipeline.
 * Falls back to analyze-only when LLM (watsonx.ai) is unavailable.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as path from "path";
import { runWorkflow, analyze } from "../src/workflow/coordinator";
import { createReleaseApproval } from "../src/mcp/tools/create_release_approval";

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
    const workflowResult = await runWorkflow({ baselinePaths, currentPaths });
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
    // LLM unavailable — fall back to deterministic analysis only
    try {
      const report = await analyze({ baselinePaths, currentPaths });
      const breakingCount = report.findings.filter((f) => f.severity === "BREAKING").length;
      const warningCount = report.findings.filter((f) => f.severity === "WARNING").length;
      const partialResult = {
        report,
        explanations: {},
        repairs: {},
        verifications: {},
        evidence: {
          runId: report.runId,
          timestamp: report.timestamp,
          passed: breakingCount === 0,
          badge: {
            schemaVersion: 1,
            label: "contracts",
            message: breakingCount === 0 ? "analyze-only" : `${breakingCount} breaking`,
            color: breakingCount === 0 ? "yellow" : "red",
          },
          sbom: [],
          patchSummary: "LLM unavailable — deterministic analysis only.",
          breakingCount,
          warningCount,
        },
        approvalToken: "",
        summaryMarkdown: "",
      };
      res.json({ status: "partial", llmError: String(err), result: partialResult });
    } catch (analyzeErr) {
      res.status(500).json({ status: "error", message: String(analyzeErr) });
    }
  }
}
