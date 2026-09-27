import type { FieldChange } from "../graph/types";
/**
 * Deep-diff two plain objects, emitting FieldChange[] with JSON-pointer paths.
 * Operates purely on the parsed `meta` — never touches source files.
 */
export declare function diffMeta(oldMeta: Record<string, unknown>, newMeta: Record<string, unknown>, basePath?: string): FieldChange[];
//# sourceMappingURL=differ.d.ts.map