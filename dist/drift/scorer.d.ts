import type { FieldChange, DriftFinding, ContractNode } from "../graph/types";
/**
 * Deterministic severity rules. No LLM involved.
 *
 * Rules (applied in order):
 *   Removed required field               → BREAKING
 *   Type narrowed                        → BREAKING
 *   Required field added to response     → BREAKING (consumers didn't expect it as required)
 *   Type widened (optional added)        → WARNING
 *   Non-required field removed from req  → WARNING
 *   Added optional field                 → INFO
 *   Any other change                     → INFO
 */
export declare function scoreChanges(node: ContractNode, changes: FieldChange[], affectedConsumers: string[]): DriftFinding;
//# sourceMappingURL=scorer.d.ts.map