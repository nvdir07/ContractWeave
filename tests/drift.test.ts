import * as path from "path";
import { diffMeta } from "../src/drift/differ";
import { scoreChanges } from "../src/drift/scorer";
import { parseOpenApi } from "../src/parsers/openapi";
import { parseZodSchema } from "../src/parsers/zod";
import type { ContractNode } from "../src/graph/types";

const FIXTURES = path.join(__dirname, "../fixtures");

// ---------------------------------------------------------------------------
// diffMeta
// ---------------------------------------------------------------------------
describe("diffMeta", () => {
  it("detects removed field", () => {
    const changes = diffMeta({ name: "Alice" }, {}, "");
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("removed");
    expect(changes[0].path).toBe("/name");
    expect(changes[0].oldVal).toBe("Alice");
    expect(changes[0].newVal).toBeUndefined();
  });

  it("detects added field", () => {
    const changes = diffMeta({}, { email: "a@b.com" }, "");
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("added");
    expect(changes[0].path).toBe("/email");
  });

  it("detects type-widened (optional: false → true)", () => {
    const old = { fields: { email: { type: "string", optional: false } } };
    const next = { fields: { email: { type: "string", optional: true } } };
    const changes = diffMeta(old, next, "");
    const widened = changes.find((c) => c.kind === "type-widened");
    expect(widened).toBeDefined();
    expect(widened?.path).toContain("/optional");
  });

  it("detects type-narrowed (optional: true → false)", () => {
    const old = { fields: { email: { type: "string", optional: true } } };
    const next = { fields: { email: { type: "string", optional: false } } };
    const changes = diffMeta(old, next, "");
    const narrowed = changes.find((c) => c.kind === "type-narrowed");
    expect(narrowed).toBeDefined();
  });

  it("returns empty array for identical objects", () => {
    const meta = { title: "API", version: "1.0" };
    expect(diffMeta(meta, meta, "")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// scoreChanges — severity rules
// ---------------------------------------------------------------------------
function fakeNode(kind: ContractNode["kind"], label = "test"): ContractNode {
  return {
    id: "test-id",
    kind,
    sourcePath: "/test/path",
    digest: "abc",
    label,
    meta: {},
  };
}

describe("scoreChanges — severity rules", () => {
  it("BREAKING for removed field in OpenAPI response", () => {
    const node = fakeNode("openapi");
    const changes = diffMeta(
      { responses: { "200": { schema: { properties: { name: { type: "string" } } } } } },
      { responses: { "200": { schema: { properties: {} } } } },
      ""
    );
    const finding = scoreChanges(node, changes, []);
    expect(finding.severity).toBe("BREAKING");
  });

  it("BREAKING for removed field in Zod schema", () => {
    const node = fakeNode("zod-schema");
    const changes = diffMeta(
      { fields: { name: { type: "string", optional: false } } },
      { fields: {} },
      ""
    );
    const finding = scoreChanges(node, changes, []);
    expect(finding.severity).toBe("BREAKING");
  });

  it("WARNING for type-widened (optional added)", () => {
    const node = fakeNode("zod-schema");
    const changes = diffMeta(
      { fields: { email: { type: "string", optional: false } } },
      { fields: { email: { type: "string", optional: true } } },
      ""
    );
    const finding = scoreChanges(node, changes, []);
    expect(finding.severity).toBe("WARNING");
  });

  it("BREAKING for type-narrowed", () => {
    const node = fakeNode("zod-schema");
    const changes = [
      { path: "/fields/email/optional", kind: "type-narrowed" as const, oldVal: true, newVal: false },
    ];
    const finding = scoreChanges(node, changes, []);
    expect(finding.severity).toBe("BREAKING");
  });

  it("INFO for added optional field", () => {
    const node = fakeNode("openapi");
    const changes = diffMeta(
      { properties: {} },
      { properties: { avatar: { type: "string" } } },
      ""
    );
    const finding = scoreChanges(node, changes, []);
    expect(finding.severity).toBe("INFO");
  });

  it("includes affected consumers in finding", () => {
    const node = fakeNode("openapi");
    const changes = diffMeta({ name: "Alice" }, {}, "");
    const consumers = ["consumer-1", "consumer-2"];
    const finding = scoreChanges(node, changes, consumers);
    expect(finding.affectedConsumers).toEqual(consumers);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: parse real fixtures and diff them
// ---------------------------------------------------------------------------
describe("fixture drift detection", () => {
  it("detects BREAKING change: OpenAPI name field removed", () => {
    const v1 = parseOpenApi(path.join(FIXTURES, "v1/openapi.yaml"));
    const v2 = parseOpenApi(path.join(FIXTURES, "v2/openapi.yaml"));

    expect(v1.digest).not.toBe(v2.digest); // digests differ
    const changes = diffMeta(v1.meta, v2.meta, "");
    expect(changes.length).toBeGreaterThan(0);

    const finding = scoreChanges(v2, changes, []);
    expect(finding.severity).toBe("BREAKING");
  });

  it("detects WARNING change: Zod email optional widened", () => {
    const v1 = parseZodSchema(path.join(FIXTURES, "v1/user.schema.ts"));
    const v2 = parseZodSchema(path.join(FIXTURES, "v2/user.schema.ts"));

    expect(v1.digest).not.toBe(v2.digest);
    const changes = diffMeta(v1.meta, v2.meta, "");
    expect(changes.length).toBeGreaterThan(0);

    const finding = scoreChanges(v2, changes, []);
    expect(finding.severity).toBe("WARNING");
  });
});
