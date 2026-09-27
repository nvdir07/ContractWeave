# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack

TypeScript 5 / Node.js 20 · CommonJS modules · strict mode · no bundler
Dependencies: `zod`, `js-yaml`, `@modelcontextprotocol/sdk`, `express`, `commander`, `fast-glob`
Test runner: Jest + ts-jest

## Commands

```sh
npm install           # install deps
npm run typecheck     # tsc --noEmit (run before every edit)
npm test              # all tests
npm test -- --testPathPattern tests/drift  # single test file
npm run demo          # two-scene hackathon demo (no flags needed)
npm run mcp           # start MCP server on stdio
npm run serve         # start Orchestrate HTTP skill on :3333
```

## Architecture (non-obvious)

- `src/graph/types.ts` is the single source of truth for ALL types. Never define types elsewhere.
- `src/graph/hash.ts` — node `id` = sha256(kind:path), `digest` = sha256(canonical meta JSON). Both truncated to 16 hex chars.
- `src/drift/` is 100% deterministic — zero LLM. LLM is confined to `src/llm/runtime.ts` and called only from `src/workflow/coordinator.ts`.
- `src/mcp/server.ts` uses `@modelcontextprotocol/sdk` v2 API (`registerTool`). Log only to `console.error` (stdout is the MCP protocol channel).
- `tsconfig.json` excludes `tests/` and `fixtures/` from compilation — ts-jest handles test compilation independently.

## LLM runtime

- `WATSONX_API_KEY` + `WATSONX_PROJECT_ID` present → watsonx.ai (uses direct REST, not the Node SDK)
- Otherwise → ollama at `OLLAMA_URL` (default `http://localhost:11434`) with model `OLLAMA_MODEL` (default `granite3.3:8b`)
- 60 s timeout on all LLM calls. Throws `LLMError` on failure.
- `analyze` and `verify` workflow steps work without any LLM; only `explain`, `repair`, and `evidence` call the LLM.

## MCP tools (6 exposed tools)

`get_git_diff` · `get_contract_graph` · `find_contract_consumers` · `run_contract_tests` · `apply_contract_patch` · `create_release_approval`

## Parsers

- OpenAPI: `js-yaml` load → canonicalize paths/schemas → SHA-256. Only `application/json` content-type is extracted.
- Zod: regex over source text (no TS compiler). Extracts `z.object({...})` field names + optional/nullable flags. Works on `.ts` files containing `z.object`.
- Jest: regex for `describe`/`it`/`test` string names — structural only.

## Key gotchas

- `apply_contract_patch` writes the FULL new file content (not a unified diff). LLM repair prompts must return complete file text.
- The workflow `verify` step writes a `.tmp` file, re-parses it, then deletes it — ensure write access to artifact directories.
- `run_contract_tests` requires `npx jest` to be available in `PATH`. It exits with code 1 on failures; stdout is captured and parsed as JSON (`--json` flag).
- Orchestrate skill defaults to demo fixtures when no paths are provided — safe for local demo.

## Remote

GitHub: https://github.com/nvdir07/ContractWeave
