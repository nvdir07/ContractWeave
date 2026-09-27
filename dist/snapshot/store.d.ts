import type { ContractNode, Snapshot } from "../graph/types";
export declare class SnapshotStore {
    private snapshots;
    record(node: ContractNode): void;
    getSnapshot(nodeId: string): Snapshot | undefined;
    /**
     * Returns true if the node's digest differs from the recorded snapshot.
     * Returns true (drifted) if no snapshot exists yet (first-time node).
     */
    hasDrifted(node: ContractNode): boolean;
    all(): Snapshot[];
    save(filePath: string): void;
    static load(filePath: string): SnapshotStore;
}
//# sourceMappingURL=store.d.ts.map