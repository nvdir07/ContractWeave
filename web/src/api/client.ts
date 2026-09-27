/**
 * Typed fetch wrapper for ContractWeave API routes.
 * In development, Vite proxies /api/* to http://localhost:3333.
 * In production (Vercel), /api/* routes to serverless functions.
 */

import type { WorkflowApiResponse, AnalyzeApiResponse } from "../types/contracts";

const BASE = "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  return data;
}

export interface RunWorkflowInput {
  baselinePaths?: string[];
  currentPaths?: string[];
}

/** Run the full analyze → explain → repair → verify → evidence workflow. */
export async function runWorkflow(input: RunWorkflowInput): Promise<WorkflowApiResponse> {
  return post<WorkflowApiResponse>("/run-workflow", input);
}

/** Run only the deterministic analysis step — fast, no LLM. */
export async function analyzeOnly(input: RunWorkflowInput): Promise<AnalyzeApiResponse> {
  return post<AnalyzeApiResponse>("/analyze", input);
}

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/health`);
  return res.json() as Promise<{ status: string }>;
}
