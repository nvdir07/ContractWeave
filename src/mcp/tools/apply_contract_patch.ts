import * as fs from "fs";
import * as path from "path";
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
export function applyContractPatch(
  input: ApplyContractPatchInput
): ApplyContractPatchOutput {
  const absPath = path.resolve(input.sourcePath);
  const cwd = process.cwd();

  // Enforce that the resolved path stays within cwd
  if (!absPath.startsWith(cwd + path.sep) && absPath !== cwd) {
    throw new Error(
      `Path traversal rejected: "${absPath}" is outside the working directory "${cwd}"`
    );
  }

  if (input.dryRun) {
    return { applied: false, path: absPath, preview: input.patch };
  }

  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, input.patch, "utf-8");

  return { applied: true, path: absPath };
}
