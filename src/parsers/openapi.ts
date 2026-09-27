import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { nodeId, contentDigest } from "../graph/hash";
import type { ContractNode } from "../graph/types";

interface OpenApiMeta {
  title: string;
  version: string;
  paths: Record<string, unknown>;
  schemas: Record<string, unknown>;
}

export function parseOpenApi(filePath: string): ContractNode {
  const absPath = path.resolve(filePath);
  const raw = fs.readFileSync(absPath, "utf-8");
  const doc = yaml.load(raw) as Record<string, unknown>;

  const info = (doc.info ?? {}) as Record<string, unknown>;
  const paths = (doc.paths ?? {}) as Record<string, unknown>;
  const components = (doc.components ?? {}) as Record<string, unknown>;
  const schemas = (components.schemas ?? {}) as Record<string, unknown>;

  const meta: OpenApiMeta = {
    title: String(info.title ?? ""),
    version: String(info.version ?? ""),
    paths: canonicalizePaths(paths),
    schemas: schemas,
  };

  const id = nodeId("openapi", absPath);
  const digest = contentDigest(meta as unknown as Record<string, unknown>);

  return {
    id,
    kind: "openapi",
    sourcePath: absPath,
    digest,
    label: meta.title || path.basename(filePath),
    meta: meta as unknown as Record<string, unknown>,
  };
}

/**
 * Extract the structurally relevant parts of each path operation for diffing:
 * method, parameters names+required, response schema properties.
 */
function canonicalizePaths(paths: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [route, methods] of Object.entries(paths)) {
    result[route] = {};
    if (!methods || typeof methods !== "object") continue;
    for (const [method, operation] of Object.entries(methods as Record<string, unknown>)) {
      const op = operation as Record<string, unknown>;
      (result[route] as Record<string, unknown>)[method] = {
        parameters: extractParams(op.parameters),
        responses: extractResponses(op.responses),
        requestBody: extractRequestBody(op.requestBody),
      };
    }
  }
  return result;
}

function extractParams(params: unknown): unknown {
  if (!Array.isArray(params)) return [];
  return params.map((p: Record<string, unknown>) => ({
    name: p.name,
    in: p.in,
    required: p.required ?? false,
    schema: p.schema,
  }));
}

function extractResponses(responses: unknown): unknown {
  if (!responses || typeof responses !== "object") return {};
  const result: Record<string, unknown> = {};
  for (const [code, resp] of Object.entries(responses as Record<string, unknown>)) {
    const r = resp as Record<string, unknown>;
    const content = r.content as Record<string, unknown> | undefined;
    const schema = content?.["application/json"]
      ? (content["application/json"] as Record<string, unknown>).schema
      : undefined;
    result[code] = { schema };
  }
  return result;
}

function extractRequestBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const content = b.content as Record<string, unknown> | undefined;
  return content?.["application/json"]
    ? (content["application/json"] as Record<string, unknown>).schema
    : null;
}
