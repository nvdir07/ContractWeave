/**
 * ContractWeave LLM Runtime
 *
 * Single interface: complete(system, user) → string
 *
 * Runtime detection (checked at call time, not module load):
 *   1. WATSONX_API_KEY + WATSONX_PROJECT_ID present → watsonx.ai (IBM cloud)
 *   2. DEMO_LLM=true                                → demo (offline, no network)
 *   3. Otherwise                                    → ollama at OLLAMA_URL
 *
 * The "demo" runtime is intended for offline hackathon demonstrations when
 * neither watsonx.ai credentials nor a running Ollama instance are available.
 * It generates deterministic, structured JSON from the supplied prompt so that
 * the response references the actual finding/artifact rather than generic text.
 * It never makes any network calls.
 *
 * No credentials are ever hardcoded.
 * Timeout: 60 seconds on watsonx/ollama calls. Demo returns synchronously.
 */

export type LLMRuntimeKind = "watsonx" | "ollama" | "demo";

export interface LLMRuntime {
  complete(system: string, user: string): Promise<string>;
  kind: LLMRuntimeKind;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly runtime: LLMRuntimeKind,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "LLMError";
  }
}

const TIMEOUT_MS = 60_000;

export function detectRuntime(): LLMRuntimeKind {
  if (process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID) {
    return "watsonx";
  }
  if (process.env.DEMO_LLM === "true") {
    return "demo";
  }
  return "ollama";
}

export async function complete(system: string, user: string): Promise<string> {
  const kind = detectRuntime();
  if (kind === "watsonx") return watsonxComplete(system, user);
  if (kind === "demo") return demoComplete(user);
  return ollamaComplete(system, user);
}

// ---------------------------------------------------------------------------
// demo — offline, deterministic, no network
// ---------------------------------------------------------------------------

/**
 * Extracts the most contextually relevant tokens from the user prompt to
 * populate the demo response fields. This makes responses feel grounded in
 * the actual finding rather than completely generic.
 */
function demoComplete(user: string): Promise<string> {
  // Pull the first "severity:" line, falling back to "BREAKING"
  const severityMatch = user.match(/Severity:\s*(BREAKING|WARNING|INFO)/i);
  const severity = (severityMatch?.[1]?.toUpperCase() ?? "BREAKING") as
    "BREAKING" | "WARNING" | "INFO";

  // Pull artifact kind and path from the prompt
  const kindMatch = user.match(/Contract drift.*?in\s+(\S+)\s+at\s+(\S+)/i);
  const artifactKind = kindMatch?.[1] ?? "contract";
  const artifactPath = kindMatch?.[2]?.split(/[/\\]/).slice(-2).join("/") ?? "artifact";

  // Pull the first listed change path for specificity
  const changeLine = user.match(/(?:REMOVED|ADDED|CHANGED|TYPE-WIDENED|TYPE-NARROWED)\s+(\S+)/i);
  const changedField = changeLine?.[1] ?? "a contract field";

  const riskMap: Record<string, string> = {
    BREAKING: "BREAKING",
    WARNING:  "WARNING",
    INFO:     "INFO",
  };

  const explanationMap: Record<string, string> = {
    BREAKING: `The ${artifactKind} at ${artifactPath} has a breaking change: ${changedField} was removed or narrowed. Consumers that depend on this field will fail at runtime.`,
    WARNING:  `The ${artifactKind} at ${artifactPath} has a non-breaking but risky change: ${changedField} was widened or made optional. Consumers relying on its presence may behave incorrectly.`,
    INFO:     `The ${artifactKind} at ${artifactPath} has an additive change: ${changedField} was added. Existing consumers are unaffected but should be updated to use the new field.`,
  };

  const remediationMap: Record<string, string> = {
    BREAKING: `Restore ${changedField} in the contract or update all consumers to handle its absence. Consider a versioned API migration if removal is intentional.`,
    WARNING:  `Make ${changedField} required again, or ensure all consumers validate its presence before use. Update integration tests to cover the optional case.`,
    INFO:     `No action required for existing consumers. Document the new field ${changedField} and update client types to take advantage of it.`,
  };

  const analysis = {
    risk: riskMap[severity] ?? "BREAKING",
    explanation: explanationMap[severity] ?? explanationMap["BREAKING"],
    affectedContracts: [],
    remediationRationale: remediationMap[severity] ?? remediationMap["BREAKING"],
  };

  return Promise.resolve(JSON.stringify(analysis));
}

// ---------------------------------------------------------------------------
// watsonx.ai via REST (avoids SDK version pinning issues)
// ---------------------------------------------------------------------------

async function watsonxComplete(system: string, user: string): Promise<string> {
  const apiKey = process.env.WATSONX_API_KEY!;
  const projectId = process.env.WATSONX_PROJECT_ID!;
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
    const res = await fetch(
      `${baseUrl}/ml/v1/text/chat?version=2024-05-31`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${iamToken}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new LLMError(
        `watsonx.ai returned ${res.status}: ${body}`,
        "watsonx"
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    return text.trim();
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new LLMError("watsonx.ai request timed out after 60s", "watsonx", err);
    }
    if (err instanceof LLMError) throw err;
    throw new LLMError("watsonx.ai request failed", "watsonx", err);
  } finally {
    clearTimeout(timer);
  }
}

async function getIAMToken(apiKey: string): Promise<string> {
  const res = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LLMError(`IAM token fetch failed ${res.status}: ${body}`, "watsonx");
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new LLMError("IAM token response missing access_token", "watsonx");
  }
  return data.access_token;
}

// ---------------------------------------------------------------------------
// ollama fallback
// ---------------------------------------------------------------------------

async function ollamaComplete(system: string, user: string): Promise<string> {
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

    const data = (await res.json()) as {
      message?: { content?: string };
    };
    return (data.message?.content ?? "").trim();
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new LLMError("ollama request timed out after 60s", "ollama", err);
    }
    if (err instanceof LLMError) throw err;
    throw new LLMError("ollama request failed — is ollama running?", "ollama", err);
  } finally {
    clearTimeout(timer);
  }
}

export const runtime: LLMRuntime = {
  get kind() {
    return detectRuntime();
  },
  complete,
};
