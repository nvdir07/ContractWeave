import type { ContractNode, ContractEdge } from "./types";
export declare class ContractGraph {
    private nodes;
    private edges;
    add(node: ContractNode): void;
    addEdge(edge: ContractEdge): void;
    getNode(id: string): ContractNode | undefined;
    getNodeByPath(sourcePath: string): ContractNode | undefined;
    getConsumers(nodeId: string): ContractNode[];
    getEdgesFor(nodeId: string): ContractEdge[];
    allNodes(): ContractNode[];
    allEdges(): ContractEdge[];
    toJSON(): {
        nodes: ContractNode[];
        edges: ContractEdge[];
    };
    static fromJSON(data: {
        nodes: ContractNode[];
        edges: ContractEdge[];
    }): ContractGraph;
    save(filePath: string): void;
    static load(filePath: string): ContractGraph;
}
//# sourceMappingURL=index.d.ts.map