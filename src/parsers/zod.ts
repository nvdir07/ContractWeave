import * as fs from "fs";
import * as path from "path";
import { nodeId, contentDigest } from "../graph/hash";
import type { ContractNode } from "../graph/types";

interface ZodField {
  type: string;
  optional: boolean;
  nullable: boolean;
}

interface ZodMeta {
  schemaName: string;
  fields: Record<string, ZodField>;
}

/**
 * Regex-based Zod schema parser.
 * Extracts fields from z.object({ ... }) declarations without a full TS compiler.
 * Sufficient for drift detection on field presence and optionality.
 */
export function parseZodSchema(filePath: string): ContractNode {
  const absPath = path.resolve(filePath);
  const source = fs.readFileSync(absPath, "utf-8");

  const meta = extractZodMeta(source, absPath);
  const id = nodeId("zod-schema", absPath);
  const digest = contentDigest(meta as unknown as Record<string, unknown>);

  return {
    id,
    kind: "zod-schema",
    sourcePath: absPath,
    digest,
    label: meta.schemaName || path.basename(filePath),
    meta: meta as unknown as Record<string, unknown>,
  };
}

function extractZodMeta(source: string, filePath: string): ZodMeta {
  // Find exported schema name: export const FooSchema = ...
  const nameMatch = source.match(/export\s+const\s+(\w+)\s*=/);
  const schemaName = nameMatch ? nameMatch[1] : path.basename(filePath, ".ts");

  const fields: Record<string, ZodField> = {};

  // Match z.object({ ... }) block — handles single-level only for MVP
  const objectMatch = source.match(/z\.object\(\s*\{([\s\S]*?)\}\s*\)/);
  if (objectMatch) {
    const body = objectMatch[1];
    // Each line like:  fieldName: z.string().optional(),
    const fieldRe = /(\w+)\s*:\s*(z\.[^,\n]+)/g;
    let m: RegExpExecArray | null;
    while ((m = fieldRe.exec(body)) !== null) {
      const name = m[1];
      const expr = m[2].trim();
      fields[name] = {
        type: extractZodType(expr),
        optional: expr.includes(".optional()"),
        nullable: expr.includes(".nullable()"),
      };
    }
  }

  return { schemaName, fields };
}

function extractZodType(expr: string): string {
  // Extract base type: z.string(), z.number(), z.boolean(), z.array(...), z.object(...)
  const base = expr.match(/z\.(\w+)/);
  return base ? base[1] : "unknown";
}
