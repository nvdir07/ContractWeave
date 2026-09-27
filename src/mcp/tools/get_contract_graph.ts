import * as path from "path";
import { ContractGraph } from "../../graph/index";
import { parseOpenApi } from "../../parsers/openapi";
import { parseZodSchema } from "../../parsers/zod";
import { parseJestFile } from "../../parsers/jest";
import { SnapshotStore } from "../../snapshot/store";
import { scoreChanges } from "../../drift/scorer";
import type {
  GetContractGraphInput,
  GetContractGraphOutput,
  ContractNode,
  DriftFinding,
  DriftReport,
} from "../../graph/types";
import * as crypto from "crypto";

function runId(): string {
  return crypto.randomBytes(4).toString("hex");
}

/**
 * Builds a ContractGraph from a list of file paths, computes drift against
 * a snapshot baseline (if present), and returns the graph + drift report.
 */
export function getContractGraph(
  input: GetContractGraphInput,
  snapshotPath?: string
): { output: GetContractGraphOutput; report: DriftReport } {
  const graph = new ContractGraph();
  const store = snapshotPath
    ? SnapshotStore.load(snapshotPath)
    : new SnapshotStore();

  const findings: DriftFinding[] = [];
  const scannedPaths: string[] = [];

  for (const filePath of input.paths) {
    const absPath = path.resolve(filePath);
    scannedPaths.push(absPath);

    try {
      const node = parseNode(absPath);
      if (!node) continue;

      graph.add(node);

      // Drift detection: only meaningful when snapshot already existed.
      // We do NOT diff {} vs node.meta (false-positive: all fields appear "added").
      // Instead, record a digest-mismatch finding only — the coordinator's analyze()
      // function performs proper baseline↔current meta diffing.
      if (store.hasDrifted(node)) {
        // Snapshot exists with a different digest: note the stale artifact.
        // We cannot reconstruct old meta from a digest alone, so emit a minimal INFO.
        const consumers = graph.getConsumers(node.id).map((n) => n.id);
        findings.push(scoreChanges(node, [
          {
            path: "/digest",
            kind: "changed",
            oldVal: store.getSnapshot(node.id)?.digest,
            newVal: node.digest,
          },
        ], consumers));
      }

      // Record current state as baseline
      store.record(node);
    } catch {
      // Skip unparseable files silently in graph building
    }
  }

  if (snapshotPath) store.save(snapshotPath);

  const graphJSON = graph.toJSON();
  const report: DriftReport = {
    runId: runId(),
    timestamp: new Date().toISOString(),
    findings,
    scannedPaths,
    graph: graphJSON,
    clean: findings.length === 0,
  };

  const output: GetContractGraphOutput = {
    graph: input.includeEdges ? graphJSON : { nodes: graphJSON.nodes, edges: [] },
    nodeCount: graphJSON.nodes.length,
    edgeCount: graphJSON.edges.length,
  };

  return { output, report };
}

export function parseNode(absPath: string): ContractNode | null {
  const lower = absPath.toLowerCase();
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return parseOpenApi(absPath);
  }
  if (lower.endsWith(".schema.ts") || lower.includes("schema")) {
    return parseZodSchema(absPath);
  }
  if (lower.endsWith(".test.ts") || lower.endsWith(".spec.ts")) {
    return parseJestFile(absPath);
  }
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
    return parseZodSchema(absPath); // treat unknown TS as potential schema
  }
  return null;
}
