import type { ContractNode } from "../graph/types";
/**
 * Regex-based Zod schema parser.
 * Extracts fields from z.object({ ... }) declarations without a full TS compiler.
 * Sufficient for drift detection on field presence and optionality.
 */
export declare function parseZodSchema(filePath: string): ContractNode;
//# sourceMappingURL=zod.d.ts.map