import * as crypto from "crypto";

/**
 * Stable node id: sha256(kind:sourcePath) — changes only if file moves or kind changes.
 * Stable content digest: sha256(JSON.stringify(meta)) — changes when content changes.
 */
export function nodeId(kind: string, sourcePath: string): string {
  return crypto.createHash("sha256").update(`${kind}:${sourcePath}`).digest("hex").slice(0, 16);
}

export function contentDigest(meta: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(JSON.stringify(meta)).digest("hex").slice(0, 16);
}
