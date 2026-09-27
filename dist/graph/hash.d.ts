/**
 * Stable node id: sha256(kind:sourcePath) — changes only if file moves or kind changes.
 * Stable content digest: sha256(JSON.stringify(meta)) — changes when content changes.
 */
export declare function nodeId(kind: string, sourcePath: string): string;
export declare function contentDigest(meta: Record<string, unknown>): string;
//# sourceMappingURL=hash.d.ts.map