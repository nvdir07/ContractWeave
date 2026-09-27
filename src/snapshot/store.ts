import * as fs from "fs";
import * as path from "path";
import type { ContractNode, Snapshot } from "../graph/types";

interface SnapshotFile {
  snapshots: Record<string, Snapshot>;
}

export class SnapshotStore {
  private snapshots = new Map<string, Snapshot>();

  record(node: ContractNode): void {
    this.snapshots.set(node.id, {
      nodeId: node.id,
      digest: node.digest,
      capturedAt: new Date().toISOString(),
    });
  }

  getSnapshot(nodeId: string): Snapshot | undefined {
    return this.snapshots.get(nodeId);
  }

  /**
   * Returns true if the node's digest differs from the recorded snapshot.
   * Returns true (drifted) if no snapshot exists yet (first-time node).
   */
  hasDrifted(node: ContractNode): boolean {
    const snap = this.snapshots.get(node.id);
    if (!snap) return false; // no baseline = nothing to compare
    return snap.digest !== node.digest;
  }

  all(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }

  save(filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const data: SnapshotFile = { snapshots: Object.fromEntries(this.snapshots) };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  static load(filePath: string): SnapshotStore {
    const store = new SnapshotStore();
    if (!fs.existsSync(filePath)) return store;
    const data: SnapshotFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    for (const snap of Object.values(data.snapshots)) {
      store.snapshots.set(snap.nodeId, snap);
    }
    return store;
  }
}
