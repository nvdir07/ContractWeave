import * as fs from "fs";
import * as path from "path";
import type { ContractNode, ContractEdge } from "./types";

export class ContractGraph {
  private nodes = new Map<string, ContractNode>();
  private edges: ContractEdge[] = [];

  add(node: ContractNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: ContractEdge): void {
    const exists = this.edges.some(
      (e) => e.from === edge.from && e.to === edge.to && e.rel === edge.rel
    );
    if (!exists) this.edges.push(edge);
  }

  getNode(id: string): ContractNode | undefined {
    return this.nodes.get(id);
  }

  getNodeByPath(sourcePath: string): ContractNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.sourcePath === sourcePath) return node;
    }
    return undefined;
  }

  getConsumers(nodeId: string): ContractNode[] {
    return this.edges
      .filter((e) => e.to === nodeId)
      .map((e) => this.nodes.get(e.from))
      .filter((n): n is ContractNode => n !== undefined);
  }

  getEdgesFor(nodeId: string): ContractEdge[] {
    return this.edges.filter((e) => e.from === nodeId || e.to === nodeId);
  }

  allNodes(): ContractNode[] {
    return Array.from(this.nodes.values());
  }

  allEdges(): ContractEdge[] {
    return [...this.edges];
  }

  toJSON(): { nodes: ContractNode[]; edges: ContractEdge[] } {
    return { nodes: this.allNodes(), edges: this.allEdges() };
  }

  static fromJSON(data: { nodes: ContractNode[]; edges: ContractEdge[] }): ContractGraph {
    const g = new ContractGraph();
    for (const n of data.nodes) g.add(n);
    for (const e of data.edges) g.addEdge(e);
    return g;
  }

  save(filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(this.toJSON(), null, 2), "utf-8");
  }

  static load(filePath: string): ContractGraph {
    const raw = fs.readFileSync(filePath, "utf-8");
    return ContractGraph.fromJSON(JSON.parse(raw));
  }
}
