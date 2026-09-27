#!/usr/bin/env node
/**
 * ContractWeave MCP Server
 *
 * Exposes 6 tools over stdio:
 *   1. get_git_diff
 *   2. get_contract_graph
 *   3. find_contract_consumers
 *   4. run_contract_tests
 *   5. apply_contract_patch
 *   6. create_release_approval
 *
 * Start: ts-node src/mcp/server.ts  (or node dist/mcp/server.js)
 * Logs go to stderr — never stdout (MCP protocol channel).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";

import { getGitDiff } from "./tools/get_git_diff";
import { getContractGraph } from "./tools/get_contract_graph";
import { findContractConsumers } from "./tools/find_contract_consumers";
import { runContractTests } from "./tools/run_contract_tests";
import { applyContractPatch } from "./tools/apply_contract_patch";
import { createReleaseApproval } from "./tools/create_release_approval";
import { ContractGraph } from "../graph/index";

import type { WorkflowResult } from "../graph/types";

const server = new McpServer({ name: "contractweave", version: "0.1.0" });

// Shared in-memory graph (populated by get_contract_graph calls)
let sharedGraph: ContractGraph | undefined;

// ---------------------------------------------------------------------------
// Tool: get_git_diff
// ---------------------------------------------------------------------------
server.registerTool(
  "get_git_diff",
  {
    description: "Get the git diff between two refs. Returns unified diff and list of changed files.",
    inputSchema: z.object({
      basePath: z.string().optional().describe("Working directory (defaults to cwd)"),
      fromRef: z.string().optional().describe("Base git ref (defaults to HEAD~1)"),
      toRef: z.string().optional().describe("Target git ref (defaults to HEAD)"),
    }),
  },
  async (input) => {
    try {
      const result = getGitDiff(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_contract_graph
// ---------------------------------------------------------------------------
server.registerTool(
  "get_contract_graph",
  {
    description:
      "Parse artifact files (OpenAPI YAML, Zod schemas, Jest tests) into a contract graph and detect drift.",
    inputSchema: z.object({
      paths: z.array(z.string()).describe("File paths to parse (relative to cwd)"),
      includeEdges: z.boolean().optional().describe("Include edges in output"),
      snapshotPath: z.string().optional().describe("Path to snapshot JSON for drift detection"),
    }),
  },
  async (input) => {
    try {
      const { output, report } = getContractGraph(input, input.snapshotPath);
      sharedGraph = ContractGraph.fromJSON(report.graph);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ graph: output, driftReport: report }, null, 2),
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: find_contract_consumers
// ---------------------------------------------------------------------------
server.registerTool(
  "find_contract_consumers",
  {
    description:
      "Find all artifacts that consume (depend on) a given contract node, by node id or source path.",
    inputSchema: z.object({
      nodeId: z.string().optional().describe("Contract node id"),
      sourcePath: z.string().optional().describe("Source file path of the node"),
    }),
  },
  async (input) => {
    try {
      const result = findContractConsumers(input, sharedGraph);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: run_contract_tests
// ---------------------------------------------------------------------------
server.registerTool(
  "run_contract_tests",
  {
    description: "Run Jest tests for the given file paths and return structured pass/fail results.",
    inputSchema: z.object({
      paths: z.array(z.string()).describe("File paths to test"),
      testPattern: z.string().optional().describe("Jest --testPathPattern override"),
    }),
  },
  async (input) => {
    try {
      const result = runContractTests(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: apply_contract_patch
// ---------------------------------------------------------------------------
server.registerTool(
  "apply_contract_patch",
  {
    description:
      "Apply a repair patch (new file content) to a contract artifact. Use dryRun to preview.",
    inputSchema: z.object({
      nodeId: z.string().describe("Contract node id"),
      sourcePath: z.string().describe("Target file path"),
      patch: z.string().describe("New file content to write"),
      dryRun: z.boolean().optional().describe("If true, returns preview without writing"),
    }),
  },
  async (input) => {
    try {
      const result = applyContractPatch(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: create_release_approval
// ---------------------------------------------------------------------------
server.registerTool(
  "create_release_approval",
  {
    description:
      "Generate release evidence (badge, SBOM, approval token, markdown summary) from a completed workflow result.",
    inputSchema: z.object({
      runId: z.string().describe("Workflow run identifier"),
      workflowResult: z.any().describe("WorkflowResult JSON from the workflow coordinator"),
    }),
  },
  async (input) => {
    try {
      const result = createReleaseApproval({
        runId: input.runId,
        workflowResult: input.workflowResult as WorkflowResult,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[ContractWeave MCP] server running on stdio");
}

main().catch((err) => {
  console.error("[ContractWeave MCP] fatal:", err);
  process.exit(1);
});
