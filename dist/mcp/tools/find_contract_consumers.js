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
exports.findContractConsumers = findContractConsumers;
exports.inferConsumerEdges = inferConsumerEdges;
const path = __importStar(require("path"));
/**
 * find_contract_consumers — given a node id or source path, returns all nodes
 * that depend on it (direct consumers) and the connecting edges.
 *
 * For the MVP, "consumer" heuristics:
 *   - Test files in the same directory as a schema → "tests" edge
 *   - OpenAPI files that reference a schema name → "consumes" edge
 */
function findContractConsumers(input, graph) {
    if (!graph)
        return { consumers: [], edges: [] };
    let targetNode;
    if (input.nodeId) {
        targetNode = graph.getNode(input.nodeId);
    }
    else if (input.sourcePath) {
        targetNode = graph.getNodeByPath(path.resolve(input.sourcePath));
    }
    if (!targetNode)
        return { consumers: [], edges: [] };
    const consumers = graph.getConsumers(targetNode.id);
    const edges = graph.getEdgesFor(targetNode.id).filter((e) => e.to === targetNode.id);
    return { consumers, edges };
}
/**
 * Infer consumer edges from file co-location.
 * Call this after building the graph to enrich it with derived edges.
 */
function inferConsumerEdges(graph) {
    const nodes = graph.allNodes();
    for (const testNode of nodes.filter((n) => n.kind === "jest-test")) {
        const testDir = path.dirname(testNode.sourcePath);
        for (const other of nodes) {
            if (other.id === testNode.id)
                continue;
            if (path.dirname(other.sourcePath) === testDir) {
                graph.addEdge({ from: testNode.id, to: other.id, rel: "tests" });
            }
        }
    }
    // OpenAPI → Zod schema cross-reference by schema name in title
    for (const apiNode of nodes.filter((n) => n.kind === "openapi")) {
        for (const schemaNode of nodes.filter((n) => n.kind === "zod-schema")) {
            // Simple heuristic: if openapi title contains schema name prefix
            const apiMeta = apiNode.meta;
            const zodMeta = schemaNode.meta;
            if (apiMeta.title &&
                zodMeta.schemaName &&
                apiMeta.title.toLowerCase().includes(zodMeta.schemaName.toLowerCase().replace("schema", ""))) {
                graph.addEdge({ from: apiNode.id, to: schemaNode.id, rel: "consumes" });
            }
        }
    }
}
//# sourceMappingURL=find_contract_consumers.js.map