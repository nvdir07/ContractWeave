import { ContractGraph } from "../../graph/index";
import type { FindContractConsumersInput, FindContractConsumersOutput } from "../../graph/types";
/**
 * find_contract_consumers — given a node id or source path, returns all nodes
 * that depend on it (direct consumers) and the connecting edges.
 *
 * For the MVP, "consumer" heuristics:
 *   - Test files in the same directory as a schema → "tests" edge
 *   - OpenAPI files that reference a schema name → "consumes" edge
 */
export declare function findContractConsumers(input: FindContractConsumersInput, graph?: ContractGraph): FindContractConsumersOutput;
/**
 * Infer consumer edges from file co-location.
 * Call this after building the graph to enrich it with derived edges.
 */
export declare function inferConsumerEdges(graph: ContractGraph): void;
//# sourceMappingURL=find_contract_consumers.d.ts.map