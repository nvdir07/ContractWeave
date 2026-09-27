/**
 * ContractWeave — Shared Type Model
 * All core data structures. Keep as plain JSON-serializable objects.
 * No `enum` keyword — use string literal unions for JSON round-trip safety.
 */

// ---------------------------------------------------------------------------
// Contract Graph
// ---------------------------------------------------------------------------

export type ContractNodeKind =
  | "openapi"
  | "zod-schema"
  | "ts-type"
  | "jest-test"
  | "fixture"
  | "doc"
  | "event-schema";

/**
 * A single artifact that encodes (part of) a software contract.
 * id  = sha256(kind + ":" + sourcePath) — stable, content-independent
 * digest = sha256(canonical JSON of meta) — changes when content changes
 */
export interface ContractNode {
  id: string;
  kind: ContractNodeKind;
  sourcePath: string;
  digest: string;
  label: string; // human-readable name
  meta: Record<string, unknown>; // parsed content, kind-specific
}

export type ContractEdgeRel =
  | "implements"
  | "derives-from"
  | "validates"
  | "documents"
  | "tests"
  | "consumes"
  | "produces";

export interface ContractEdge {
  from: string; // ContractNode.id
  to: string; // ContractNode.id
  rel: ContractEdgeRel;
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface Snapshot {
  nodeId: string;
  digest: string;
  capturedAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Drift
// ---------------------------------------------------------------------------

export type FieldChangeKind =
  | "added"
  | "removed"
  | "changed"
  | "type-widened"
  | "type-narrowed";

export interface FieldChange {
  path: string; // JSON-pointer style, e.g. "/properties/name"
  kind: FieldChangeKind;
  oldVal: unknown;
  newVal: unknown;
}

export type DriftSeverity = "BREAKING" | "WARNING" | "INFO";

export interface DriftFinding {
  nodeId: string;
  nodePath: string; // sourcePath for display
  nodeKind: ContractNodeKind;
  changes: FieldChange[];
  severity: DriftSeverity;
  message: string; // deterministic summary (no LLM)
  affectedConsumers: string[]; // node ids of consumers
}

export interface DriftReport {
  runId: string;
  timestamp: string; // ISO-8601
  findings: DriftFinding[];
  scannedPaths: string[];
  graph: {
    nodes: ContractNode[];
    edges: ContractEdge[];
  };
  clean: boolean;
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export interface LLMAnalysis {
  risk: DriftSeverity;
  explanation: string;
  affectedContracts: string[]; // node ids
  remediationRationale: string;
}

export interface WorkflowResult {
  report: DriftReport;
  explanations: Record<string, LLMAnalysis>; // keyed by DriftFinding.nodeId
  repairs: Record<string, string>; // keyed by DriftFinding.nodeId → patch text
  verifications: Record<string, boolean>; // keyed by DriftFinding.nodeId
  evidence: ReleaseEvidence;
}

export interface ContractSBOMEntry {
  nodeId: string;
  sourcePath: string;
  kind: ContractNodeKind;
  digest: string;
  verified: boolean;
  severity: DriftSeverity | "CLEAN";
}

export interface ReleaseEvidence {
  runId: string;
  timestamp: string;
  passed: boolean;
  badge: {
    schemaVersion: 1;
    label: string;
    message: string;
    color: string;
  };
  sbom: ContractSBOMEntry[];
  patchSummary: string; // unified summary of all repairs
  breakingCount: number;
  warningCount: number;
}

// ---------------------------------------------------------------------------
// MCP Tool I/O models
// ---------------------------------------------------------------------------

// get_git_diff
export interface GetGitDiffInput {
  basePath?: string; // defaults to cwd
  fromRef?: string; // git ref, defaults to HEAD~1
  toRef?: string; // git ref, defaults to HEAD
}
export interface GetGitDiffOutput {
  diff: string;
  changedFiles: string[];
}

// get_contract_graph
export interface GetContractGraphInput {
  paths: string[];
  includeEdges?: boolean;
}
export interface GetContractGraphOutput {
  graph: DriftReport["graph"];
  nodeCount: number;
  edgeCount: number;
}

// find_contract_consumers
export interface FindContractConsumersInput {
  nodeId?: string;
  sourcePath?: string;
}
export interface FindContractConsumersOutput {
  consumers: ContractNode[];
  edges: ContractEdge[];
}

// run_contract_tests
export interface RunContractTestsInput {
  paths: string[];
  testPattern?: string;
}
export interface RunContractTestsOutput {
  passed: boolean;
  total: number;
  failures: Array<{ test: string; error: string }>;
  stdout: string;
}

// apply_contract_patch
export interface ApplyContractPatchInput {
  nodeId: string;
  sourcePath: string;
  patch: string;
  dryRun?: boolean;
}
export interface ApplyContractPatchOutput {
  applied: boolean;
  path: string;
  preview?: string;
}

// create_release_approval
export interface CreateReleaseApprovalInput {
  runId: string;
  workflowResult: WorkflowResult;
}
export interface CreateReleaseApprovalOutput {
  evidence: ReleaseEvidence;
  approvalToken: string;
  summaryMarkdown: string;
}
