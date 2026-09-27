"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = exports.LLMError = void 0;
exports.detectRuntime = detectRuntime;
exports.complete = complete;
class LLMError extends Error {
    runtime;
    cause;
    constructor(message, runtime, cause) {
        super(message);
        this.runtime = runtime;
        this.cause = cause;
        this.name = "LLMError";
    }
}
exports.LLMError = LLMError;
const TIMEOUT_MS = 60_000;
function detectRuntime() {
    if (process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID) {
        return "watsonx";
    }
    return "ollama";
}
async function complete(system, user) {
    const kind = detectRuntime();
    if (kind === "watsonx") {
        return watsonxComplete(system, user);
    }
    return ollamaComplete(system, user);
}
// ---------------------------------------------------------------------------
// watsonx.ai via REST (avoids SDK version pinning issues)
// ---------------------------------------------------------------------------
async function watsonxComplete(system, user) {
    const apiKey = process.env.WATSONX_API_KEY;
    const projectId = process.env.WATSONX_PROJECT_ID;
    const baseUrl = process.env.WATSONX_URL ?? "https://us-south.ml.cloud.ibm.com";
    const model = process.env.WATSONX_MODEL ?? "ibm/granite-3-3-8b-instruct";
    // Get IAM token
    const iamToken = await getIAMToken(apiKey);
    const payload = {
        model_id: model,
        project_id: projectId,
        messages: [
            { role: "system", content: system },
            { role: "user", content: user },
        ],
        parameters: {
            max_new_tokens: 1024,
            temperature: 0.1,
        },
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${baseUrl}/ml/v1/text/chat?version=2024-05-31`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${iamToken}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new LLMError(`watsonx.ai returned ${res.status}: ${body}`, "watsonx");
        }
        const data = (await res.json());
        const text = data.choices?.[0]?.message?.content ?? "";
        return text.trim();
    }
    catch (err) {
        if (err.name === "AbortError") {
            throw new LLMError("watsonx.ai request timed out after 60s", "watsonx", err);
        }
        if (err instanceof LLMError)
            throw err;
        throw new LLMError("watsonx.ai request failed", "watsonx", err);
    }
    finally {
        clearTimeout(timer);
    }
}
async function getIAMToken(apiKey) {
    const res = await fetch("https://iam.cloud.ibm.com/identity/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new LLMError(`IAM token fetch failed ${res.status}: ${body}`, "watsonx");
    }
    const data = (await res.json());
    if (!data.access_token) {
        throw new LLMError("IAM token response missing access_token", "watsonx");
    }
    return data.access_token;
}
// ---------------------------------------------------------------------------
// ollama fallback
// ---------------------------------------------------------------------------
async function ollamaComplete(system, user) {
    const baseUrl = process.env.OLLAMA_URL ?? "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL ?? "granite3.3:8b";
    const payload = {
        model,
        messages: [
            { role: "system", content: system },
            { role: "user", content: user },
        ],
        stream: false,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new LLMError(`ollama returned ${res.status}: ${body}`, "ollama");
        }
        const data = (await res.json());
        return (data.message?.content ?? "").trim();
    }
    catch (err) {
        if (err.name === "AbortError") {
            throw new LLMError("ollama request timed out after 60s", "ollama", err);
        }
        if (err instanceof LLMError)
            throw err;
        throw new LLMError("ollama request failed — is ollama running?", "ollama", err);
    }
    finally {
        clearTimeout(timer);
    }
}
exports.runtime = {
    get kind() {
        return detectRuntime();
    },
    complete,
};
//# sourceMappingURL=runtime.js.map