import { ContractGraph } from "../../graph/index";
import type {
  FindContractConsumersInput,
  FindContractConsumersOutput,
  ContractNode,
  ContractEdge,
} from "../../graph/types";
import * as path from "path";

/**
 * find_contract_consumers — given a node id or source path, returns all nodes
 * that depend on it (direct consumers) and the connecting edges.
 *
 * For the MVP, "consumer" heuristics:
 *   - Test files in the same directory as a schema → "tests" edge
 *   - OpenAPI files that reference a schema name → "consumes" edge
 */
export function findContractConsumers(
  input: FindContractConsumersInput,
  graph?: ContractGraph
): FindContractConsumersOutput {
  if (!graph) return { consumers: [], edges: [] };

  let targetNode: ContractNode | undefined;

  if (input.nodeId) {
    targetNode = graph.getNode(input.nodeId);
  } else if (input.sourcePath) {
    targetNode = graph.getNodeByPath(path.resolve(input.sourcePath));
  }

  if (!targetNode) return { consumers: [], edges: [] };

  const consumers = graph.getConsumers(targetNode.id);
  const edges = graph.getEdgesFor(targetNode.id).filter(
    (e: ContractEdge) => e.to === targetNode!.id
  );

  return { consumers, edges };
}

/**
 * Infer consumer edges from file co-location.
 * Call this after building the graph to enrich it with derived edges.
 */
export function inferConsumerEdges(graph: ContractGraph): void {
  const nodes = graph.allNodes();

  for (const testNode of nodes.filter((n) => n.kind === "jest-test")) {
    const testDir = path.dirname(testNode.sourcePath);
    for (const other of nodes) {
      if (other.id === testNode.id) continue;
      if (path.dirname(other.sourcePath) === testDir) {
        graph.addEdge({ from: testNode.id, to: other.id, rel: "tests" });
      }
    }
  }

  // OpenAPI → Zod schema cross-reference by schema name in title
  for (const apiNode of nodes.filter((n) => n.kind === "openapi")) {
    for (const schemaNode of nodes.filter((n) => n.kind === "zod-schema")) {
      // Simple heuristic: if openapi title contains schema name prefix
      const apiMeta = apiNode.meta as { title?: string };
      const zodMeta = schemaNode.meta as { schemaName?: string };
      if (
        apiMeta.title &&
        zodMeta.schemaName &&
        apiMeta.title.toLowerCase().includes(zodMeta.schemaName.toLowerCase().replace("schema", ""))
      ) {
        graph.addEdge({ from: apiNode.id, to: schemaNode.id, rel: "consumes" });
      }
    }
  }
}
