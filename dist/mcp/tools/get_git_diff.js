"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGitDiff = getGitDiff;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
/**
 * Safe git ref pattern: allows branch names, commit hashes, HEAD~N, tags.
 * Rejects any ref containing shell metacharacters.
 */
const SAFE_GIT_REF = /^[a-zA-Z0-9_.~^@{}[\]:/\\-]{1,256}$/;
function validateRef(ref, label) {
    if (!SAFE_GIT_REF.test(ref)) {
        throw new Error(`Invalid git ref for ${label}: "${ref}" contains disallowed characters`);
    }
}
/**
 * get_git_diff — returns unified diff and list of changed files.
 * Uses execFileSync (no shell interpolation) to prevent shell injection.
 * Gracefully returns empty diff if not a git repo.
 */
function getGitDiff(input) {
    const cwd = path.resolve(input.basePath ?? ".");
    const from = input.fromRef ?? "HEAD~1";
    const to = input.toRef ?? "HEAD";
    // Validate refs before passing to git — prevents shell injection
    try {
        validateRef(from, "fromRef");
        validateRef(to, "toRef");
    }
    catch (err) {
        // Invalid refs: return empty result (same as non-git-repo behavior)
        return { diff: "", changedFiles: [] };
    }
    try {
        // execFileSync does NOT invoke a shell — args are passed directly to git
        const diff = (0, child_process_1.execFileSync)("git", ["diff", from, to], { cwd, encoding: "utf-8" });
        const filesRaw = (0, child_process_1.execFileSync)("git", ["diff", "--name-only", from, to], {
            cwd,
            encoding: "utf-8",
        });
        const changedFiles = filesRaw
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((f) => path.join(cwd, f));
        return { diff, changedFiles };
    }
    catch {
        // Not a git repo, no commits, or invalid ref
        return { diff: "", changedFiles: [] };
    }
}
//# sourceMappingURL=get_git_diff.js.map