import * as path from "path";
import { ContractGraph } from "../src/graph/index";
import { nodeId, contentDigest } from "../src/graph/hash";
import type { ContractNode, ContractEdge } from "../src/graph/types";

function makeNode(kind: ContractNode["kind"], p: string): ContractNode {
  const id = nodeId(kind, p);
  const meta = { label: "test" };
  return {
    id,
    kind,
    sourcePath: p,
    digest: contentDigest(meta),
    label: path.basename(p),
    meta,
  };
}

describe("ContractGraph", () => {
  it("adds and retrieves nodes", () => {
    const g = new ContractGraph();
    const n = makeNode("openapi", "/api/openapi.yaml");
    g.add(n);
    expect(g.getNode(n.id)).toEqual(n);
  });

  it("looks up by sourcePath", () => {
    const g = new ContractGraph();
    const n = makeNode("zod-schema", "/src/user.schema.ts");
    g.add(n);
    expect(g.getNodeByPath("/src/user.schema.ts")).toEqual(n);
  });

  it("adds edges without duplicates", () => {
    const g = new ContractGraph();
    const a = makeNode("openapi", "/a");
    const b = makeNode("zod-schema", "/b");
    g.add(a);
    g.add(b);
    const edge: ContractEdge = { from: a.id, to: b.id, rel: "consumes" };
    g.addEdge(edge);
    g.addEdge(edge); // duplicate
    expect(g.allEdges()).toHaveLength(1);
  });

  it("returns consumers of a node", () => {
    const g = new ContractGraph();
    const api = makeNode("openapi", "/api.yaml");
    const test = makeNode("jest-test", "/api.test.ts");
    g.add(api);
    g.add(test);
    g.addEdge({ from: test.id, to: api.id, rel: "tests" });
    const consumers = g.getConsumers(api.id);
    expect(consumers).toHaveLength(1);
    expect(consumers[0].id).toBe(test.id);
  });

  it("serializes and deserializes via JSON", () => {
    const g = new ContractGraph();
    const n1 = makeNode("openapi", "/api.yaml");
    const n2 = makeNode("jest-test", "/api.test.ts");
    g.add(n1);
    g.add(n2);
    g.addEdge({ from: n2.id, to: n1.id, rel: "tests" });

    const json = g.toJSON();
    const g2 = ContractGraph.fromJSON(json);
    expect(g2.allNodes()).toHaveLength(2);
    expect(g2.allEdges()).toHaveLength(1);
    expect(g2.getNode(n1.id)?.sourcePath).toBe("/api.yaml");
  });
});

describe("nodeId and contentDigest", () => {
  it("produces stable ids for same kind+path", () => {
    const id1 = nodeId("openapi", "/api/openapi.yaml");
    const id2 = nodeId("openapi", "/api/openapi.yaml");
    expect(id1).toBe(id2);
  });

  it("produces different ids for different paths", () => {
    const id1 = nodeId("openapi", "/a.yaml");
    const id2 = nodeId("openapi", "/b.yaml");
    expect(id1).not.toBe(id2);
  });

  it("digest changes when meta changes", () => {
    const d1 = contentDigest({ fields: { name: { type: "string", optional: false } } });
    const d2 = contentDigest({ fields: { name: { type: "string", optional: true } } });
    expect(d1).not.toBe(d2);
  });

  it("digest is stable for same meta", () => {
    const meta = { fields: { id: { type: "number", optional: false } } };
    expect(contentDigest(meta)).toBe(contentDigest(meta));
  });
});
