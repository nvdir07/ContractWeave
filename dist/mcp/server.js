#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
// @ts-nocheck
const mcp_1 = require("@modelcontextprotocol/sdk/server/mcp");
const stdio_1 = require("@modelcontextprotocol/sdk/server/stdio");
const zod_1 = require("zod");
const get_git_diff_1 = require("./tools/get_git_diff");
const get_contract_graph_1 = require("./tools/get_contract_graph");
const find_contract_consumers_1 = require("./tools/find_contract_consumers");
const run_contract_tests_1 = require("./tools/run_contract_tests");
const apply_contract_patch_1 = require("./tools/apply_contract_patch");
const create_release_approval_1 = require("./tools/create_release_approval");
const index_1 = require("../graph/index");
const server = new mcp_1.McpServer({ name: "contractweave", version: "0.1.0" });
// Shared in-memory graph (populated by get_contract_graph calls)
let sharedGraph;
// ---------------------------------------------------------------------------
// Tool: get_git_diff
// ---------------------------------------------------------------------------
server.registerTool("get_git_diff", {
    description: "Get the git diff between two refs. Returns unified diff and list of changed files.",
    inputSchema: zod_1.z.object({
        basePath: zod_1.z.string().optional().describe("Working directory (defaults to cwd)"),
        fromRef: zod_1.z.string().optional().describe("Base git ref (defaults to HEAD~1)"),
        toRef: zod_1.z.string().optional().describe("Target git ref (defaults to HEAD)"),
    }),
}, async (input) => {
    try {
        const result = (0, get_git_diff_1.getGitDiff)(input);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
});
// ---------------------------------------------------------------------------
// Tool: get_contract_graph
// ---------------------------------------------------------------------------
server.registerTool("get_contract_graph", {
    description: "Parse artifact files (OpenAPI YAML, Zod schemas, Jest tests) into a contract graph and detect drift.",
    inputSchema: zod_1.z.object({
        paths: zod_1.z.array(zod_1.z.string()).describe("File paths to parse (relative to cwd)"),
        includeEdges: zod_1.z.boolean().optional().describe("Include edges in output"),
        snapshotPath: zod_1.z.string().optional().describe("Path to snapshot JSON for drift detection"),
    }),
}, async (input) => {
    try {
        const { output, report } = (0, get_contract_graph_1.getContractGraph)(input, input.snapshotPath);
        sharedGraph = index_1.ContractGraph.fromJSON(report.graph);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ graph: output, driftReport: report }, null, 2),
                },
            ],
        };
    }
    catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
});
// ---------------------------------------------------------------------------
// Tool: find_contract_consumers
// ---------------------------------------------------------------------------
server.registerTool("find_contract_consumers", {
    description: "Find all artifacts that consume (depend on) a given contract node, by node id or source path.",
    inputSchema: zod_1.z.object({
        nodeId: zod_1.z.string().optional().describe("Contract node id"),
        sourcePath: zod_1.z.string().optional().describe("Source file path of the node"),
    }),
}, async (input) => {
    try {
        const result = (0, find_contract_consumers_1.findContractConsumers)(input, sharedGraph);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
});
// ---------------------------------------------------------------------------
// Tool: run_contract_tests
// ---------------------------------------------------------------------------
server.registerTool("run_contract_tests", {
    description: "Run Jest tests for the given file paths and return structured pass/fail results.",
    inputSchema: zod_1.z.object({
        paths: zod_1.z.array(zod_1.z.string()).describe("File paths to test"),
        testPattern: zod_1.z.string().optional().describe("Jest --testPathPattern override"),
    }),
}, async (input) => {
    try {
        const result = (0, run_contract_tests_1.runContractTests)(input);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
});
// ---------------------------------------------------------------------------
// Tool: apply_contract_patch
// ---------------------------------------------------------------------------
server.registerTool("apply_contract_patch", {
    description: "Apply a repair patch (new file content) to a contract artifact. Use dryRun to preview.",
    inputSchema: zod_1.z.object({
        nodeId: zod_1.z.string().describe("Contract node id"),
        sourcePath: zod_1.z.string().describe("Target file path"),
        patch: zod_1.z.string().describe("New file content to write"),
        dryRun: zod_1.z.boolean().optional().describe("If true, returns preview without writing"),
    }),
}, async (input) => {
    try {
        const result = (0, apply_contract_patch_1.applyContractPatch)(input);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
});
// ---------------------------------------------------------------------------
// Tool: create_release_approval
// ---------------------------------------------------------------------------
server.registerTool("create_release_approval", {
    description: "Generate release evidence (badge, SBOM, approval token, markdown summary) from a completed workflow result.",
    inputSchema: zod_1.z.object({
        runId: zod_1.z.string().describe("Workflow run identifier"),
        workflowResult: zod_1.z.any().describe("WorkflowResult JSON from the workflow coordinator"),
    }),
}, async (input) => {
    try {
        const result = (0, create_release_approval_1.createReleaseApproval)({
            runId: input.runId,
            workflowResult: input.workflowResult,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
});
// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
    const transport = new stdio_1.StdioServerTransport();
    await server.connect(transport);
    console.error("[ContractWeave MCP] server running on stdio");
}
main().catch((err) => {
    console.error("[ContractWeave MCP] fatal:", err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map