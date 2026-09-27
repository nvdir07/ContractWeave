/**
 * Type-only re-exports from the backend.
 * Vite discards these at runtime — they are shapes only, no runtime values.
 * This is the single source of truth for all data structures in the frontend.
 */

// Re-export every type the frontend needs
export type {
  ContractNode,
  ContractNodeKind,
  ContractEdge,
  ContractEdgeRel,
  FieldChange,
  FieldChangeKind,
  DriftFinding,
  DriftSeverity,
  DriftReport,
  LLMAnalysis,
  WorkflowResult,
  ReleaseEvidence,
  ContractSBOMEntry,
} from "../../../src/graph/types";

// Extended response type that the API returns (WorkflowResult + approvalToken)
export interface WorkflowApiResponse {
  status: "ok" | "partial" | "error";
  result: WorkflowResultWithToken;
  llmError?: string;
  message?: string;
}

import type { WorkflowResult } from "../../../src/graph/types";

export interface WorkflowResultWithToken extends WorkflowResult {
  approvalToken: string;
  summaryMarkdown: string;
}

export interface AnalyzeApiResponse {
  status: "ok" | "error";
  report: import("../../../src/graph/types").DriftReport;
  message?: string;
}
