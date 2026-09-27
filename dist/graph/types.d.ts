/**
 * ContractWeave — Shared Type Model
 * All core data structures. Keep as plain JSON-serializable objects.
 * No `enum` keyword — use string literal unions for JSON round-trip safety.
 */
export type ContractNodeKind = "openapi" | "zod-schema" | "ts-type" | "jest-test" | "fixture" | "doc" | "event-schema";
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
    label: string;
    meta: Record<string, unknown>;
}
export type ContractEdgeRel = "implements" | "derives-from" | "validates" | "documents" | "tests" | "consumes" | "produces";
export interface ContractEdge {
    from: string;
    to: string;
    rel: ContractEdgeRel;
}
export interface Snapshot {
    nodeId: string;
    digest: string;
    capturedAt: string;
}
export type FieldChangeKind = "added" | "removed" | "changed" | "type-widened" | "type-narrowed";
export interface FieldChange {
    path: string;
    kind: FieldChangeKind;
    oldVal: unknown;
    newVal: unknown;
}
export type DriftSeverity = "BREAKING" | "WARNING" | "INFO";
export interface DriftFinding {
    nodeId: string;
    nodePath: string;
    nodeKind: ContractNodeKind;
    changes: FieldChange[];
    severity: DriftSeverity;
    message: string;
    affectedConsumers: string[];
}
export interface DriftReport {
    runId: string;
    timestamp: string;
    findings: DriftFinding[];
    scannedPaths: string[];
    graph: {
        nodes: ContractNode[];
        edges: ContractEdge[];
    };
    clean: boolean;
}
export interface LLMAnalysis {
    risk: DriftSeverity;
    explanation: string;
    affectedContracts: string[];
    remediationRationale: string;
}
export interface WorkflowResult {
    report: DriftReport;
    explanations: Record<string, LLMAnalysis>;
    repairs: Record<string, string>;
    verifications: Record<string, boolean>;
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
    patchSummary: string;
    breakingCount: number;
    warningCount: number;
}
export interface GetGitDiffInput {
    basePath?: string;
    fromRef?: string;
    toRef?: string;
}
export interface GetGitDiffOutput {
    diff: string;
    changedFiles: string[];
}
export interface GetContractGraphInput {
    paths: string[];
    includeEdges?: boolean;
}
export interface GetContractGraphOutput {
    graph: DriftReport["graph"];
    nodeCount: number;
    edgeCount: number;
}
export interface FindContractConsumersInput {
    nodeId?: string;
    sourcePath?: string;
}
export interface FindContractConsumersOutput {
    consumers: ContractNode[];
    edges: ContractEdge[];
}
export interface RunContractTestsInput {
    paths: string[];
    testPattern?: string;
}
export interface RunContractTestsOutput {
    passed: boolean;
    total: number;
    failures: Array<{
        test: string;
        error: string;
    }>;
    stdout: string;
}
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
export interface CreateReleaseApprovalInput {
    runId: string;
    workflowResult: WorkflowResult;
}
export interface CreateReleaseApprovalOutput {
    evidence: ReleaseEvidence;
    approvalToken: string;
    summaryMarkdown: string;
}
//# sourceMappingURL=types.d.ts.map