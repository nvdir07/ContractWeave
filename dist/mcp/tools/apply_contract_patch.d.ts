import type { ApplyContractPatchInput, ApplyContractPatchOutput } from "../../graph/types";
/**
 * apply_contract_patch — applies a text patch to a contract artifact.
 * In dry-run mode, returns a preview without writing.
 * The patch is expected to be the full new file content (not a unified diff)
 * for hackathon reliability; unified diff application requires the `patch` binary.
 *
 * SECURITY: rejects paths that resolve outside the current working directory
 * to prevent path traversal attacks.
 */
export declare function applyContractPatch(input: ApplyContractPatchInput): ApplyContractPatchOutput;
//# sourceMappingURL=apply_contract_patch.d.ts.map