import type { GetGitDiffInput, GetGitDiffOutput } from "../../graph/types";
/**
 * get_git_diff — returns unified diff and list of changed files.
 * Uses execFileSync (no shell interpolation) to prevent shell injection.
 * Gracefully returns empty diff if not a git repo.
 */
export declare function getGitDiff(input: GetGitDiffInput): GetGitDiffOutput;
//# sourceMappingURL=get_git_diff.d.ts.map