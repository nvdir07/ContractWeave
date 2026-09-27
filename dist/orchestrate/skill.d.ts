/**
 * ContractWeave — watsonx Orchestrate Skill Server
 *
 * Routes:
 *   POST /orchestrate/run-workflow — Orchestrate skill endpoint (original)
 *   POST /api/run-workflow         — Dashboard endpoint (full workflow + approvalToken)
 *   POST /api/analyze              — Dashboard fast path (deterministic, no LLM)
 *   GET  /health                   — Health check
 *
 * No auth for local demo.
 */
import express from "express";
export declare function createSkillServer(): express.Application;
//# sourceMappingURL=skill.d.ts.map