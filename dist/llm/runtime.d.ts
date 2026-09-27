/**
 * ContractWeave LLM Runtime
 *
 * Single interface: complete(system, user) → string
 *
 * Runtime detection (checked at call time, not module load):
 *   - WATSONX_API_KEY + WATSONX_PROJECT_ID present → watsonx.ai
 *   - Otherwise → ollama at OLLAMA_URL
 *
 * No credentials are ever hardcoded.
 * Timeout: 60 seconds on all calls.
 */
export type LLMRuntimeKind = "watsonx" | "ollama";
export interface LLMRuntime {
    complete(system: string, user: string): Promise<string>;
    kind: LLMRuntimeKind;
}
export declare class LLMError extends Error {
    readonly runtime: LLMRuntimeKind;
    readonly cause?: unknown | undefined;
    constructor(message: string, runtime: LLMRuntimeKind, cause?: unknown | undefined);
}
export declare function detectRuntime(): LLMRuntimeKind;
export declare function complete(system: string, user: string): Promise<string>;
export declare const runtime: LLMRuntime;
//# sourceMappingURL=runtime.d.ts.map