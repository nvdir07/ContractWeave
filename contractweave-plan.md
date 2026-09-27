# ContractWeave — Architecture & Implementation Plan

## Top-Level Overview

ContractWeave is a semantic contract-integrity system for TypeScript/Node.js projects.
It builds a graph of every artifact that encodes a software contract (OpenAPI schemas,
Zod/TypeScript types, Jest tests, JSON fixtures), detects structural drift between
versions deterministically, and then uses a watsonx.ai / ollama LLM to explain,
repair, verify, and produce release evidence — all exposed through an MCP server so
any agent runtime (including watsonx Orchestrate) can call it.

**Target demo**: Two chained scenarios (OpenAPI breaking change + Zod type-widening)
run as a single `contractweave demo` CLI command in ≤ 3 minutes.

**Non-goals for this phase**: UI, database persistence, multi-repo support,
authentication, deployment infrastructure.

---

## Exact File Tree to Create

```
ContractWeave/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── cli.ts                        # demo entry point
│   ├── graph/
│   │   ├── types.ts                  # ContractNode, ContractEdge, all shared types
│   │   └── index.ts                  # in-memory registry + JSON persistence
│   ├── parsers/
│   │   ├── openapi.ts                # parse OpenAPI YAML → ContractNode
│   │   ├── zod.ts                    # parse Zod/TS schema files → ContractNode
│   │   └── jest.ts                   # parse Jest test files → ContractNode
│   ├── snapshot/
│   │   └── store.ts                  # SHA-256 digest versioning
│   ├── drift/
│   │   ├── types.ts                  # FieldChange, DriftFinding, DriftReport
│   │   ├── differ.ts                 # structural diff of two node snapshots
│   │   └── scorer.ts                 # deterministic BREAKING/WARNING/INFO rules
│   ├── llm/
│   │   └── runtime.ts                # watsonx.ai + ollama dual-mode complete()
│   ├── workflow/
│   │   └── coordinator.ts            # chains analyze→explain→repair→verify→evidence
│   ├── mcp/
│   │   ├── server.ts                 # MCP server bootstrap
│   │   └── tools/
│   │       ├── analyze.ts
│   │       ├── explain.ts
│   │       ├── repair.ts
│   │       ├── verify.ts
│   │       └── evidence.ts
│   └── orchestrate/
│       └── skill.ts                  # Express HTTP skill for Orchestrate
├── fixtures/
│   ├── v1/
│   │   ├── openapi.yaml              # baseline: GET /users returns {id, name}
│   │   └── user.schema.ts            # baseline: email z.string()
│   └── v2/
│       ├── openapi.yaml              # drift: removes "name" field (BREAKING)
│       └── user.schema.ts            # drift: email z.string().optional() (WARNING)
└── tests/
    ├── graph.test.ts
    ├── drift.test.ts
    └── workflow.test.ts
```

---

## Sub-Task 1 — Project Scaffold & Shared Types

**Status**: [x] done

**Intent**
Create the repository skeleton: `package.json`, `tsconfig.json`, `.env.example`,
and `src/graph/types.ts`. This is the zero-dependency foundation that every other
sub-task imports from. Getting the type model right here prevents churn downstream.

**Expected Outcomes**
- `npm install` succeeds
- `npx tsc --noEmit` passes on an empty project
- All shared types compile and are importable

**Todo List**
1. Create `package.json` with dependencies:
   `typescript`, `ts-node`, `zod`, `js-yaml`, `@modelcontextprotocol/sdk`,
   `@ibm-generative-ai/node-sdk`, `express`, `fast-glob`, `commander`
   and devDependencies: `jest`, `ts-jest`, `@types/node`, `@types/js-yaml`
2. Create `tsconfig.json` — strict mode, `moduleResolution: bundler`,
   `target: ES2022`, output to `dist/`
3. Create `.env.example` with `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`,
   `WATSONX_URL`, `OLLAMA_URL` (defaults to `http://localhost:11434`)
4. Create `src/graph/types.ts` with the full data model:
   `ContractNode`, `ContractEdge`, `FieldChange`, `DriftFinding`,
   `DriftReport`, `WorkflowResult`, `ReleaseEvidence`

**Relevant Context**
- Core data model is defined in the architecture section above
- Keep all type enums as string literals (no `enum` keyword) for easy JSON round-tripping

---

## Sub-Task 2 — Artifact Parsers

**Status**: [x] done

**Intent**
Implement the three parsers that convert real artifacts into normalized `ContractNode`
objects. Each parser must produce a stable `digest` (SHA-256 of canonical JSON) so
the snapshot store can detect any change.

**Expected Outcomes**
- `parseOpenApi("fixtures/v1/openapi.yaml")` returns a `ContractNode` with `kind: "openapi"`
- `parseZodSchema("fixtures/v1/user.schema.ts")` returns a `ContractNode` with `kind: "zod-schema"`
- Digests change when the source file changes; identical files produce identical digests

**Todo List**
1. Create `src/parsers/openapi.ts` — use `js-yaml` to load, extract paths/schemas,
   produce canonical JSON, SHA-256 hash it
2. Create `src/parsers/zod.ts` — read the file as text, extract exported `z.*` expressions
   via regex (no full TS compilation needed for MVP), produce canonical form
3. Create `src/parsers/jest.ts` — read file as text, extract `describe`/`it`/`test` names
   as the canonical form (structural, not semantic)
4. Create `src/graph/index.ts` — `ContractGraph` class with `add(node)`, `addEdge(edge)`,
   `getNode(id)`, `toJSON()`, `fromJSON()` methods
5. Create `src/snapshot/store.ts` — `SnapshotStore` with `record(node)`, `diff(nodeId, newNode)`,
   `load(path)`, `save(path)` using a JSON file

**Relevant Context**
- The `id` of a `ContractNode` is `sha256(kind + ":" + sourcePath)` — stable across content changes
- The `digest` is `sha256(JSON.stringify(canonicalMeta))` — changes when content changes
- Zod parser only needs to extract field names and their type annotations for MVP;
  full AST parsing is not required

---

## Sub-Task 3 — Drift Engine

**Status**: [x] done

**Intent**
Implement the deterministic differ and severity scorer. These must produce identical
output for identical inputs — no randomness, no LLM. This is the engine that makes
ContractWeave trustworthy.

**Expected Outcomes**
- Removing `name` from OpenAPI response schema produces a `BREAKING` `DriftFinding`
- Widening `z.string()` to `z.string().optional()` produces a `WARNING` `DriftFinding`
- Adding a new optional field produces an `INFO` `DriftFinding`
- `DriftReport` is a plain JSON-serializable object

**Todo List**
1. Create `src/drift/types.ts` (re-export from `src/graph/types.ts` if already defined there)
2. Create `src/drift/differ.ts` — deep-diff two `ContractNode.meta` objects using JSON pointer
   paths; emit `FieldChange[]`
3. Create `src/drift/scorer.ts` — rule table (no LLM):
   - Removed required field → BREAKING
   - Changed type to narrower → BREAKING
   - Changed type to wider (optional added) → WARNING
   - Added required field to response → WARNING
   - Added optional field → INFO
   - Renamed field → BREAKING (treated as remove + add)
4. Write `tests/drift.test.ts` covering all severity rules

**Relevant Context**
- The differ operates on `meta` objects only; it never touches source files directly
- For OpenAPI, the relevant sub-tree is `paths.*.*.responses.*.content.*.schema`
  and `components.schemas.*`
- For Zod, the canonical meta is `{ fields: Record<name, {type: string, optional: boolean}> }`

---

## Sub-Task 4 — LLM Runtime

**Status**: [x] done

**Intent**
Implement the single `complete(systemPrompt, userPrompt)` function with watsonx.ai
primary and ollama fallback. This is the only file that has any network I/O to an LLM.

**Expected Outcomes**
- When `WATSONX_API_KEY` is set, calls watsonx.ai `ibm/granite-3-3-8b-instruct`
- When env vars are absent, calls `ollama` at `OLLAMA_URL` with model `granite3.3:8b`
- Returns a plain string; throws a typed `LLMError` on failure
- Timeout of 30 seconds on all calls

**Todo List**
1. Create `src/llm/runtime.ts` with:
   - `detectRuntime()` — checks env vars, returns `"watsonx" | "ollama"`
   - `complete(system, user)` — dispatches to the right client
   - `watsonxComplete(system, user)` — uses `@ibm-generative-ai/node-sdk` `TextService`
   - `ollamaComplete(system, user)` — uses `fetch` to `POST /api/chat`
2. Export a `LLMRuntime` type describing the single method interface
3. Write a simple smoke test (mocked) in `tests/` to verify dispatch logic

**Relevant Context**
- watsonx.ai SDK: `new TextService({ apiKey, projectId, url }).generate({ modelId, input })`
- ollama API: `POST /api/chat` with `{ model, messages: [{role, content}], stream: false }`
- Do NOT use streaming for MVP — wait for full response

---

## Sub-Task 5 — MCP Server & Tools

**Status**: [x] done

**Intent**
Expose the five workflow tools over MCP so any MCP-capable agent (Bob, Orchestrate,
Claude Desktop) can call them. The MCP server is the public API of ContractWeave.

**Expected Outcomes**
- `npx contractweave mcp` starts an MCP server on stdio
- All five tools respond correctly to JSON-RPC calls
- `analyze_contracts` is callable without LLM credentials (pure deterministic)
- The other four tools require LLM (will error clearly if unavailable)

**Todo List**
1. Create `src/mcp/tools/analyze.ts` — wraps parsers + graph + snapshot + drift engine
2. Create `src/mcp/tools/explain.ts` — iterates findings, calls `complete()` with
   a structured explain prompt per finding
3. Create `src/mcp/tools/repair.ts` — for each BREAKING/WARNING finding, calls `complete()`
   with repair prompt including the original source text
4. Create `src/mcp/tools/verify.ts` — re-parses the repaired source, runs differ,
   returns `{ clean: boolean, residualFindings }`
5. Create `src/mcp/tools/evidence.ts` — assembles `ReleaseEvidence` from `WorkflowResult`
6. Create `src/mcp/server.ts` — registers all five tools using `@modelcontextprotocol/sdk`
   `registerTool` API

**Relevant Context**
- Tool input/output schemas must be JSON Schema objects (MCP requirement)
- The `analyze_contracts` tool input is `{ paths: string[] }` — paths are relative to cwd
- Keep prompt templates in the tool files themselves (not a separate prompts/ directory)

---

## Sub-Task 6 — Demo Fixtures & CLI

**Status**: [x] done

**Intent**
Create the two-scene demo fixtures and the `contractweave demo` CLI command that chains
both scenarios and produces visible terminal output suitable for a 3-minute recording.

**Expected Outcomes**
- `npx ts-node src/cli.ts demo` runs both scenarios end-to-end
- Terminal output shows: artifact paths → drift findings with severity → LLM explanations →
  repairs → verification result → release evidence badge
- Entire run completes in under 90 seconds on a warm ollama instance
- Output is readable (colored, structured) without being verbose

**Todo List**
1. Create `fixtures/v1/openapi.yaml` — `GET /users` returns `{ id: integer, name: string }`
   (both required)
2. Create `fixtures/v2/openapi.yaml` — same but `name` removed from response schema
3. Create `fixtures/v1/user.schema.ts` — `const UserSchema = z.object({ id: z.number(), email: z.string() })`
4. Create `fixtures/v2/user.schema.ts` — `email: z.string().optional()`
5. Create `src/workflow/coordinator.ts` — `runWorkflow(paths: string[])` chains all 5 steps,
   returns `WorkflowResult`
6. Create `src/cli.ts` — uses `commander`, implements `demo` command that calls
   `runWorkflow` on both fixture pairs and prints structured output

**Relevant Context**
- The CLI should print a clear section header before each step (ANALYZE / EXPLAIN / REPAIR /
  VERIFY / EVIDENCE) so the demo video has obvious visual chapters
- Use `process.stdout.write` with ANSI colors for terminal output; no external chalk dependency
  unless already in package.json
- The `demo` command should NOT require any flags — zero-config execution for the video

---

## Sub-Task 7 — watsonx Orchestrate Skill

**Status**: [x] done

**Intent**
Add the thin HTTP wrapper that lets watsonx Orchestrate call ContractWeave as a skill.
This is the integration boundary proof-of-concept for the hackathon.

**Expected Outcomes**
- `POST /orchestrate/run-workflow` with `{ "request": "check contracts at ./fixtures" }`
  chains all 5 MCP tools and returns a `WorkflowResult` as JSON
- The skill definition YAML (for importing into Orchestrate) is committed to the repo

**Todo List**
1. Create `src/orchestrate/skill.ts` — Express app with single POST route; extract paths from
   request body, call `runWorkflow`, return JSON
2. Create `orchestrate-skill.yaml` — OpenAPI 3.0 skill definition pointing at the local server
3. Add `contractweave serve` CLI command that starts the Express skill server on port 3333

**Relevant Context**
- Orchestrate skill definitions use OpenAPI 3.0 format with `x-openai-isConsequential: false`
- The skill only needs one endpoint for MVP; no auth for local demo

---

## Sub-Task 8 — Tests & AGENTS.md Update

**Status**: [x] done

**Intent**
Write the minimum test suite that verifies the deterministic core (graph, drift) is
correct, and update AGENTS.md with the now-real project details.

**Expected Outcomes**
- `npm test` runs and passes
- `tests/graph.test.ts` covers node creation, edge addition, serialization
- `tests/drift.test.ts` covers all severity rules with fixture data
- `AGENTS.md` reflects the actual stack and commands

**Todo List**
1. Write `tests/graph.test.ts`
2. Write `tests/drift.test.ts` (expand from Sub-Task 3)
3. Write `tests/workflow.test.ts` — mock the LLM runtime, verify coordinator chains correctly
4. Add `jest.config.ts` with `ts-jest` preset
5. Update `AGENTS.md` with real commands, stack, and project-specific gotchas

---

## Architecture Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| LLM dual-mode | watsonx.ai primary / ollama fallback | Demo works offline; judges with watsonx creds see the real thing |
| Drift engine | Pure deterministic, no LLM | Reproducible CI results; LLM only for UX (explain/repair) |
| Zod parser | Regex over source text | No TS compiler dependency at runtime; fast; sufficient for MVP |
| MCP transport | stdio | Works with any MCP host; no port conflicts |
| Orchestrate integration | HTTP skill over Express | Standard Orchestrate pattern; can be imported in ≤ 2 minutes |
| Persistence | JSON files | Zero infrastructure; reproducible in demo |
| Graph storage | In-memory + JSON file | Simplest reliable option for MVP |
