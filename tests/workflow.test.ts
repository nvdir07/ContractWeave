import * as path from "path";
import { analyze } from "../src/workflow/coordinator";

const FIXTURES = path.join(__dirname, "../fixtures");

// ---------------------------------------------------------------------------
// Mock LLM so workflow tests don't need a real LLM
// ---------------------------------------------------------------------------
jest.mock("../src/llm/runtime", () => ({
  detectRuntime: () => "ollama",
  complete: jest.fn().mockResolvedValue(
    JSON.stringify({
      risk: "BREAKING",
      explanation: "Mocked LLM explanation",
      affectedContracts: [],
      remediationRationale: "Mocked remediation",
    })
  ),
  runtime: {
    kind: "ollama",
    complete: jest.fn().mockResolvedValue("{}"),
  },
}));

describe("analyze (deterministic — no LLM)", () => {
  it("returns clean report when baseline === current", async () => {
    const paths = [path.join(FIXTURES, "v1/openapi.yaml")];
    const report = await analyze({ baselinePaths: paths, currentPaths: paths });
    expect(report.clean).toBe(true);
    expect(report.findings).toHaveLength(0);
  });

  it("detects drift between v1 and v2 OpenAPI", async () => {
    const report = await analyze({
      baselinePaths: [path.join(FIXTURES, "v1/openapi.yaml")],
      currentPaths: [path.join(FIXTURES, "v2/openapi.yaml")],
    });
    expect(report.clean).toBe(false);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings.some((f) => f.severity === "BREAKING")).toBe(true);
  });

  it("detects drift between v1 and v2 Zod schema", async () => {
    const report = await analyze({
      baselinePaths: [path.join(FIXTURES, "v1/user.schema.ts")],
      currentPaths: [path.join(FIXTURES, "v2/user.schema.ts")],
    });
    expect(report.clean).toBe(false);
    expect(report.findings.length).toBeGreaterThan(0);
    // Zod email: optional widened → WARNING
    expect(report.findings.some((f) => f.severity === "WARNING" || f.severity === "BREAKING")).toBe(true);
  });

  it("includes scannedPaths in report", async () => {
    const current = path.join(FIXTURES, "v2/openapi.yaml");
    const report = await analyze({
      baselinePaths: [path.join(FIXTURES, "v1/openapi.yaml")],
      currentPaths: [current],
    });
    expect(report.scannedPaths.some((p) => p.includes("v2"))).toBe(true);
  });

  it("report has runId and timestamp", async () => {
    const report = await analyze({
      baselinePaths: [path.join(FIXTURES, "v1/openapi.yaml")],
      currentPaths: [path.join(FIXTURES, "v2/openapi.yaml")],
    });
    expect(report.runId).toBeTruthy();
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
