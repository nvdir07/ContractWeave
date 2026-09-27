/**
 * ContractWeave Workflow Coordinator
 *
 * Chains: analyze → explain → repair → verify → evidence
 *
 * The LLM is involved only in explain, repair, and evidence steps.
 * analyze and verify are deterministic.
 */
import type { DriftReport, LLMAnalysis, WorkflowResult } from "../graph/types";
export interface WorkflowOptions {
    baselinePaths: string[];
    currentPaths: string[];
    snapshotFile?: string;
}
export declare function analyze(opts: WorkflowOptions): Promise<DriftReport>;
export declare function explain(report: DriftReport): Promise<Record<string, LLMAnalysis>>;
export declare function repair(report: DriftReport, currentPaths: string[]): Promise<Record<string, string>>;
export declare function verify(report: DriftReport, repairs: Record<string, string>): Promise<Record<string, boolean>>;
export declare function evidence(report: DriftReport, explanations: Record<string, LLMAnalysis>, repairs: Record<string, string>, verifications: Record<string, boolean>): Promise<WorkflowResult>;
export declare function runWorkflow(opts: WorkflowOptions): Promise<WorkflowResult>;
//# sourceMappingURL=coordinator.d.ts.map