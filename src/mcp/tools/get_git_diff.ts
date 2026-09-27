import { execFileSync } from "child_process";
import * as path from "path";
import type { GetGitDiffInput, GetGitDiffOutput } from "../../graph/types";

/**
 * Safe git ref pattern: allows branch names, commit hashes, HEAD~N, tags.
 * Rejects any ref containing shell metacharacters.
 */
const SAFE_GIT_REF = /^[a-zA-Z0-9_.~^@{}[\]:/\\-]{1,256}$/;

function validateRef(ref: string, label: string): void {
  if (!SAFE_GIT_REF.test(ref)) {
    throw new Error(
      `Invalid git ref for ${label}: "${ref}" contains disallowed characters`
    );
  }
}

/**
 * get_git_diff — returns unified diff and list of changed files.
 * Uses execFileSync (no shell interpolation) to prevent shell injection.
 * Gracefully returns empty diff if not a git repo.
 */
export function getGitDiff(input: GetGitDiffInput): GetGitDiffOutput {
  const cwd = path.resolve(input.basePath ?? ".");
  const from = input.fromRef ?? "HEAD~1";
  const to = input.toRef ?? "HEAD";

  // Validate refs before passing to git — prevents shell injection
  try {
    validateRef(from, "fromRef");
    validateRef(to, "toRef");
  } catch (err) {
    // Invalid refs: return empty result (same as non-git-repo behavior)
    return { diff: "", changedFiles: [] };
  }

  try {
    // execFileSync does NOT invoke a shell — args are passed directly to git
    const diff = execFileSync("git", ["diff", from, to], { cwd, encoding: "utf-8" });
    const filesRaw = execFileSync("git", ["diff", "--name-only", from, to], {
      cwd,
      encoding: "utf-8",
    });
    const changedFiles = filesRaw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((f) => path.join(cwd, f));

    return { diff, changedFiles };
  } catch {
    // Not a git repo, no commits, or invalid ref
    return { diff: "", changedFiles: [] };
  }
}
