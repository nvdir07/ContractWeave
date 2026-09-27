"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContractGraph = getContractGraph;
exports.parseNode = parseNode;
const path = __importStar(require("path"));
const index_1 = require("../../graph/index");
const openapi_1 = require("../../parsers/openapi");
const zod_1 = require("../../parsers/zod");
const jest_1 = require("../../parsers/jest");
const store_1 = require("../../snapshot/store");
const scorer_1 = require("../../drift/scorer");
const crypto = __importStar(require("crypto"));
function runId() {
    return crypto.randomBytes(4).toString("hex");
}
/**
 * Builds a ContractGraph from a list of file paths, computes drift against
 * a snapshot baseline (if present), and returns the graph + drift report.
 */
function getContractGraph(input, snapshotPath) {
    const graph = new index_1.ContractGraph();
    const store = snapshotPath
        ? store_1.SnapshotStore.load(snapshotPath)
        : new store_1.SnapshotStore();
    const findings = [];
    const scannedPaths = [];
    for (const filePath of input.paths) {
        const absPath = path.resolve(filePath);
        scannedPaths.push(absPath);
        try {
            const node = parseNode(absPath);
            if (!node)
                continue;
            graph.add(node);
            // Drift detection: only meaningful when snapshot already existed.
            // We do NOT diff {} vs node.meta (false-positive: all fields appear "added").
            // Instead, record a digest-mismatch finding only — the coordinator's analyze()
            // function performs proper baseline↔current meta diffing.
            if (store.hasDrifted(node)) {
                // Snapshot exists with a different digest: note the stale artifact.
                // We cannot reconstruct old meta from a digest alone, so emit a minimal INFO.
                const consumers = graph.getConsumers(node.id).map((n) => n.id);
                findings.push((0, scorer_1.scoreChanges)(node, [
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
        }
        catch {
            // Skip unparseable files silently in graph building
        }
    }
    if (snapshotPath)
        store.save(snapshotPath);
    const graphJSON = graph.toJSON();
    const report = {
        runId: runId(),
        timestamp: new Date().toISOString(),
        findings,
        scannedPaths,
        graph: graphJSON,
        clean: findings.length === 0,
    };
    const output = {
        graph: input.includeEdges ? graphJSON : { nodes: graphJSON.nodes, edges: [] },
        nodeCount: graphJSON.nodes.length,
        edgeCount: graphJSON.edges.length,
    };
    return { output, report };
}
function parseNode(absPath) {
    const lower = absPath.toLowerCase();
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
        return (0, openapi_1.parseOpenApi)(absPath);
    }
    if (lower.endsWith(".schema.ts") || lower.includes("schema")) {
        return (0, zod_1.parseZodSchema)(absPath);
    }
    if (lower.endsWith(".test.ts") || lower.endsWith(".spec.ts")) {
        return (0, jest_1.parseJestFile)(absPath);
    }
    if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
        return (0, zod_1.parseZodSchema)(absPath); // treat unknown TS as potential schema
    }
    return null;
}
//# sourceMappingURL=get_contract_graph.js.map