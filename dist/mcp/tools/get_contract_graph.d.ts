import type { GetContractGraphInput, GetContractGraphOutput, ContractNode, DriftReport } from "../../graph/types";
/**
 * Builds a ContractGraph from a list of file paths, computes drift against
 * a snapshot baseline (if present), and returns the graph + drift report.
 */
export declare function getContractGraph(input: GetContractGraphInput, snapshotPath?: string): {
    output: GetContractGraphOutput;
    report: DriftReport;
};
export declare function parseNode(absPath: string): ContractNode | null;
//# sourceMappingURL=get_contract_graph.d.ts.map