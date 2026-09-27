# ContractWeave — Frontend Implementation Plan

> **DO NOT IMPLEMENT UNTIL THIS PLAN IS APPROVED.**
> This is a planning document only.

---

## Executive Summary

The existing backend is complete and healthy:
- CommonJS TypeScript compiled to `dist/`, working `npm run build`
- Express already in `dependencies` (no new HTTP dep needed)
- `src/orchestrate/skill.ts` already exports `createSkillServer()` returning an `express.Application`
- The existing `npm run serve` command starts that server on `:3333`
- All 5 workflow steps (`analyze → explain → repair → verify → evidence`) produce `WorkflowResult` — a single JSON object that contains everything the dashboard needs

**The safest and smallest frontend architecture is:**

```
web/                    ← standalone Vite + React app (its own package.json)
  src/
    types/shared.ts     ← re-export only, import from ../../src/graph/types
api/                    ← NEW: Vercel-compatible Express API routes (thin wrappers)
  run-workflow.ts
  health.ts
vercel.json             ← rewrites: /api/* → api/, /* → web/dist/
```

**The existing Express skill server (`src/orchestrate/skill.ts`) is REUSED as-is** — the API layer simply imports and extends it. Nothing in `src/` is removed or changed beyond adding one new `npm run ui:dev` script.

---

## Architecture Decision: Why Vite Subpackage vs Monorepo Root

### Option A — Vite in root alongside backend (risky)
Adding `vite.config.ts`, `index.html`, and React deps to the root `package.json` would:
- Conflict with `"rootDir": "src"` in `tsconfig.json`
- Force `tsconfig.json` changes to accommodate JSX, possibly breaking `npm run typecheck`
- Risk mixing CommonJS (backend) and ESM (Vite) in the same package
- Contaminate the backend build with frontend deps

### Option B — `web/` subpackage with its own `package.json` ✅ CHOSEN
- **Zero risk to existing backend.** The root `package.json`, `tsconfig.json`, `jest.config.ts`, and all `npm run *` commands are untouched.
- Vite's own `tsconfig.json` in `web/` uses `"module": "ESNext"` and `"jsx": "react-jsx"` — completely isolated.
- Shared types are imported via a relative path `../../src/graph/types` as a **type-only import** — Vite's build discards them at runtime (they're just TypeScript shapes, no runtime value).
- Backend build script (`tsc`) ignores `web/` because `tsconfig.json` has `"include": ["src/**/*"]`.

---

## Exact Files to Create or Modify

### New files

| File | Purpose |
|---|---|
| `web/package.json` | Vite + React subpackage; `dev`, `build`, `preview` scripts |
| `web/tsconfig.json` | ESNext, jsx react-jsx, strict; includes only `web/src` |
| `web/vite.config.ts` | Proxy `/api/*` → `localhost:3333` in dev; no backend bundling |
| `web/index.html` | Vite entry HTML |
| `web/src/main.tsx` | React root mount |
| `web/src/App.tsx` | Router shell (React Router v6) |
| `web/src/types/contracts.ts` | Re-export of backend types (type-only import) |
| `web/src/api/client.ts` | Typed fetch wrapper for all API routes |
| `web/src/pages/DashboardPage.tsx` | Landing: run overview + "Analyze Release" button |
| `web/src/pages/GraphPage.tsx` | Contract graph visualisation |
| `web/src/pages/FindingsPage.tsx` | Drift findings list with severity badges |
| `web/src/pages/ExplanationPage.tsx` | LLM explanations per finding |
| `web/src/pages/RepairPage.tsx` | Repair preview diff |
| `web/src/pages/VerifyPage.tsx` | Verification results |
| `web/src/pages/EvidencePage.tsx` | Release evidence: badge + SBOM table + approval token |
| `web/src/components/SeverityBadge.tsx` | Shared badge component |
| `web/src/components/StepNav.tsx` | Stepper nav: Analyze → Graph → Findings → … |
| `web/src/components/ContractGraphViz.tsx` | SVG/canvas node+edge diagram |
| `web/src/hooks/useWorkflow.ts` | State machine: idle → loading → result |
| `vercel.json` | Rewrites to route API and static |
| `api/run-workflow.ts` | Vercel serverless: POST body → `runWorkflow()` |
| `api/analyze.ts` | Vercel serverless: POST body → `analyze()` only (fast, no LLM) |
| `api/health.ts` | Vercel serverless: GET → `{ status: "ok" }` |

### Existing files modified

| File | Change | Risk | Rollback |
|---|---|---|---|
| `package.json` | Add `"ui:dev"`, `"ui:build"`, `"ui:preview"` scripts | **Minimal** — scripts only, no dep changes | Delete the 3 script lines |
| `src/orchestrate/skill.ts` | Add CORS header and 2 new routes (`/api/run-workflow`, `/api/analyze`) | **Low** — additive only, existing routes unchanged | `git checkout src/orchestrate/skill.ts` |

### Existing files NOT touched

`tsconfig.json`, `jest.config.ts`, `src/cli.ts`, `src/mcp/server.ts`, `src/workflow/coordinator.ts`, `src/graph/types.ts`, all parsers, all drift engine files, all test files.

---

## API Layer Design

The `src/orchestrate/skill.ts` Express server already has `POST /orchestrate/run-workflow`. The dashboard needs two endpoints:

### `POST /api/run-workflow`
**Input** (JSON body):
```json
{
  "baselinePaths": ["fixtures/v1/openapi.yaml", "fixtures/v1/user.schema.ts"],
  "currentPaths":  ["fixtures/v2/openapi.yaml", "fixtures/v2/user.schema.ts"]
}
```
**Output**: `WorkflowResult` (the full type from `src/graph/types.ts`)

**Implementation**: Calls `runWorkflow({ baselinePaths, currentPaths })` from `src/workflow/coordinator.ts`. This is exactly what the Orchestrate skill already does — only the route path changes.

### `POST /api/analyze`
**Input**: same body shape  
**Output**: `DriftReport` (deterministic, no LLM — fast path for the graph page)

**Implementation**: Calls `analyze({ baselinePaths, currentPaths })`.

### `GET /health`
Already exists. No change.

**Modification to `skill.ts`** — add two routes and CORS:
```typescript
// CORS for local Vite dev server (dev only — safe in demo context)
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.post("/api/run-workflow", async (req, res) => { /* same logic as /orchestrate/run-workflow */ });
app.post("/api/analyze",       async (req, res) => { /* calls analyze() only */ });
```

The existing `/orchestrate/run-workflow` route is **not touched**.

---

## Frontend Component Hierarchy

```
App.tsx
└── StepNav (progress stepper — always visible)
└── Router
    ├── /                      DashboardPage
    │     RunForm (baseline/current paths, pre-filled with fixture paths)
    │     Last run summary (from localStorage cache)
    │
    ├── /graph                 GraphPage
    │     ContractGraphViz     (SVG layout: nodes as circles, edges as arrows)
    │     Node detail panel    (click a node → shows kind, digest, label)
    │
    ├── /findings              FindingsPage
    │     FindingCard × N      (severity badge, message, change list)
    │
    ├── /explain               ExplanationPage
    │     ExplanationCard × N  (risk badge, explanation text, remediation)
    │
    ├── /repair                RepairPage
    │     RepairDiff × N       (monospace before/after, or patch text)
    │
    ├── /verify                VerifyPage
    │     VerificationRow × N  (✓ CLEAN / ✗ RESIDUAL per nodeId)
    │
    └── /evidence              EvidencePage
          BadgeDisplay         (shields.io badge image)
          SBOMTable            (all artifacts: kind, digest, severity, verified)
          ApprovalBlock        (token, passed/failed, patchSummary)
          DownloadButton       (downloads WorkflowResult as JSON)
```

---

## State Management

**No Redux, no Zustand.** Single React context — `WorkflowContext` — holding:
```typescript
interface WorkflowState {
  status: "idle" | "analyzing" | "complete" | "error";
  baselinePaths: string[];
  currentPaths:  string[];
  result: WorkflowResult | null;
  error: string | null;
}
```

Persisted to `localStorage` under `"contractweave:last-result"` so the demo can navigate between pages without re-running. A "Run Again" button clears and re-triggers.

---

## Contract Graph Visualisation

**No D3, no external graph library** — pure SVG generated from the node/edge data using a simple **layered force-free layout**:

1. Group nodes by `kind` into vertical lanes: `openapi | zod-schema | jest-test | fixture | doc`
2. Space nodes evenly within each lane
3. Draw edges as SVG `<line>` or `<path>` elements with arrowhead markers

This is ~80 lines of layout math — no new dependencies.

If the graph has >20 nodes (not the case for demo fixtures), collapse nodes into a summary "×N" chip.

---

## Vercel Deployment Architecture

```
vercel.json
{
  "buildCommand": "cd web && npm install && npm run build",
  "outputDirectory": "web/dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/:path*",     "destination": "/index.html" }
  ]
}
```

The `api/` directory uses Vercel's **Node.js Serverless Functions** feature:
- `api/run-workflow.ts` — imports `runWorkflow` from `../../src/workflow/coordinator`
- `api/analyze.ts` — imports `analyze` from `../../src/workflow/coordinator`
- `api/health.ts` — `{ status: "ok" }`

Vercel bundles these with `@vercel/node` — no separate build step needed.

**Important constraint on Vercel**: `runWorkflow` calls the LLM (watsonx.ai or ollama). On Vercel, ollama won't be available. The API must gracefully fall back: if LLM fails, call `analyze()` only and return a partial `WorkflowResult` with `explanations: {}`, `repairs: {}`, `verifications: {}`. This fallback path already exists in `src/cli.ts` (the `catch` block around `runWorkflow`).

For the hackathon demo, the LLM will be provided via `WATSONX_API_KEY` + `WATSONX_PROJECT_ID` as Vercel environment variables. No code change needed — `src/llm/runtime.ts` reads them from `process.env`.

**Local dev**: Vite proxy (`/api/*` → `http://localhost:3333`) routes to the Express server started by `npm run serve`.

---

## Dependencies to Add

### `web/package.json` (frontend — isolated, not in root)
| Package | Version | Purpose |
|---|---|---|
| `react` | `^18` | UI framework |
| `react-dom` | `^18` | DOM rendering |
| `react-router-dom` | `^6` | Client-side routing |
| `@types/react` | `^18` | dev |
| `@types/react-dom` | `^18` | dev |
| `vite` | `^5` | dev bundler |
| `@vitejs/plugin-react` | `^4` | dev |
| `typescript` | `^5` | dev (same version as backend) |

**Total: 3 runtime deps, 5 devDeps** — all in `web/` only, invisible to the root build.

### Root `package.json` additions
None. The 3 new scripts (`ui:dev`, `ui:build`, `ui:preview`) are `cd web && npm ...` commands — they delegate entirely to the subpackage.

### `api/` Vercel functions
These import from `src/` directly. Vercel's bundler handles the CommonJS backend. No additional deps needed beyond those already in root `package.json`.

---

## Demo Flow (3-minute video path)

1. Browser opens `http://localhost:5173` (Vite dev) or deployed Vercel URL
2. **Dashboard**: paths pre-filled with `fixtures/v1/` and `fixtures/v2/`. Click **"Analyze Release"**
3. Loading spinner → API call to `POST /api/run-workflow` → ~30s (LLM) or ~1s (analyze-only)
4. **Contract Graph**: 4 nodes (2 OpenAPI, 2 Zod), 2 edges — SVG diagram appears
5. **Drift Findings**: 2 findings — `BREAKING` (OpenAPI name removed), `WARNING` (Zod optional widened)
6. **AI Explanation**: watsonx.ai explanation per finding with `remediationRationale`
7. **Repair**: LLM-generated patch text shown in monospace diff view
8. **Verify**: `✓ CLEAN` or `✗ RESIDUAL DRIFT` per artifact
9. **Release Evidence**: badge (red/green), SBOM table (4 rows), approval token, download button

Navigation via **StepNav** component — each step clickable only after data is available (disabled until workflow completes).

---

## Sub-Task Breakdown (for implementation phase)

### FE-1 — API extension (modify `src/orchestrate/skill.ts`)
- Add CORS middleware (dev-only)
- Add `POST /api/run-workflow` route (delegates to `runWorkflow`)
- Add `POST /api/analyze` route (delegates to `analyze`)
- **Rollback**: `git checkout src/orchestrate/skill.ts`

### FE-2 — Vercel functions (`api/`)
- `api/health.ts`
- `api/analyze.ts`
- `api/run-workflow.ts`
- `vercel.json`

### FE-3 — Web scaffold (`web/`)
- `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`
- `web/src/main.tsx`, `web/src/App.tsx`
- `web/src/types/contracts.ts` (type re-exports)
- `web/src/api/client.ts`

### FE-4 — Context + hooks
- `web/src/context/WorkflowContext.tsx`
- `web/src/hooks/useWorkflow.ts`

### FE-5 — Shared components
- `SeverityBadge.tsx`, `StepNav.tsx`, `ContractGraphViz.tsx`

### FE-6 — Pages (implement in demo-flow order)
- `DashboardPage.tsx` (run form)
- `GraphPage.tsx`
- `FindingsPage.tsx`
- `ExplanationPage.tsx`
- `RepairPage.tsx`
- `VerifyPage.tsx`
- `EvidencePage.tsx`

### FE-7 — Root script additions + AGENTS.md update
- 3 scripts added to root `package.json`
- AGENTS.md updated with new commands

---

## Rollback Strategy Per Risk

| Risk | Trigger | Rollback |
|---|---|---|
| `npm run typecheck` breaks | If Vite types leak into root TS | `git checkout tsconfig.json` — root tsconfig never touches `web/` |
| `npm test` breaks | If any import in test files picks up frontend code | Frontend lives in `web/` which jest ignores (`testPathIgnorePatterns`) — impossible |
| `npm run build` breaks | If `tsc` picks up `web/src` | `tsconfig.json` `include` is `["src/**/*"]` — `web/` never included |
| `npm run serve` breaks | If `skill.ts` changes introduce a syntax error | `git checkout src/orchestrate/skill.ts` — restore in 1 command |
| `npm run demo` breaks | If coordinator or graph types changed | This plan makes NO changes to those files |
| Vercel deployment fails | `api/` serverless functions fail to bundle | Remove `api/` directory; Vercel falls back to static-only serving |

---

## Verification Commands (after each sub-task)

Run these after every sub-task to confirm nothing regressed:

```sh
# After FE-1 (skill.ts changes):
npm run typecheck
npm test
npm run serve &
curl http://localhost:3333/health
curl -X POST http://localhost:3333/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"baselinePaths":["fixtures/v1/openapi.yaml"],"currentPaths":["fixtures/v2/openapi.yaml"]}'
kill %1

# After FE-2 (vercel functions):
npm run typecheck   # vercel functions are excluded from root tsconfig

# After FE-3 – FE-6 (web subpackage):
npm run typecheck   # root — must still pass
npm test            # root — must still pass
npm run build       # root tsc — must still pass
cd web && npm install && npm run build  # frontend build
cd ..

# Full regression before PR:
npm run typecheck
npm test
npm run build
npm run demo    # (requires LLM or shows graceful fallback)
```

---

## What Existing API Data Already Contains (no invention needed)

The frontend maps directly to `WorkflowResult` fields — **no data is manufactured in the frontend**:

| Dashboard section | Source field |
|---|---|
| Run ID / timestamp | `result.report.runId`, `result.report.timestamp` |
| Contract graph nodes | `result.report.graph.nodes` |
| Contract graph edges | `result.report.graph.edges` |
| Scanned paths | `result.report.scannedPaths` |
| Drift findings | `result.report.findings[]` |
| Finding severity | `finding.severity` |
| AI explanation | `result.explanations[nodeId].explanation` |
| Remediation rationale | `result.explanations[nodeId].remediationRationale` |
| Repair patch | `result.repairs[nodeId]` |
| Verification status | `result.verifications[nodeId]` |
| Badge | `result.evidence.badge` |
| SBOM entries | `result.evidence.sbom[]` |
| Approval token | `result.evidence.???.approvalToken` (from `CreateReleaseApprovalOutput`) |
| Patch summary | `result.evidence.patchSummary` |
| Breaking count | `result.evidence.breakingCount` |
| Warning count | `result.evidence.warningCount` |

> **Note**: `WorkflowResult.evidence` is `ReleaseEvidence` which does not include `approvalToken` (that lives in `CreateReleaseApprovalOutput`). The API route for `run-workflow` should return the full `CreateReleaseApprovalOutput` merged with the `WorkflowResult`, not just `WorkflowResult`. This is the only data-shape clarification needed — no new types, just a wrapper response.

---

## Open Questions Before Implementation

1. **LLM on Vercel**: Should the deployed `/api/run-workflow` fall back to `analyze`-only when watsonx credentials are absent, or return a clear error? Recommendation: return partial result with `{ report, explanations: {}, repairs: {}, verifications: {}, evidence: ... }` computed from the deterministic report.

2. **Graph visualisation complexity**: If demo fixtures grow beyond 10 nodes, the simple SVG layout may need a force-directed library (e.g. `d3-force`). For 4 nodes (current fixtures), pure SVG is sufficient.

3. **`approvalToken` in response**: Since `approvalToken` is produced by `createReleaseApproval()` but lives outside `WorkflowResult`, the `/api/run-workflow` response type needs to be `WorkflowResult & { approvalToken: string; summaryMarkdown: string }`. This requires a 1-line change to the API route only — no type changes to `src/graph/types.ts`.

4. **Styling**: CSS Modules or Tailwind? Recommendation: **plain CSS Modules** — zero additional dependencies, no PostCSS config needed, works identically in Vite and Vercel.
