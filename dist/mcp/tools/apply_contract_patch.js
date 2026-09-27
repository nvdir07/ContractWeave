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
exports.applyContractPatch = applyContractPatch;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * apply_contract_patch — applies a text patch to a contract artifact.
 * In dry-run mode, returns a preview without writing.
 * The patch is expected to be the full new file content (not a unified diff)
 * for hackathon reliability; unified diff application requires the `patch` binary.
 *
 * SECURITY: rejects paths that resolve outside the current working directory
 * to prevent path traversal attacks.
 */
function applyContractPatch(input) {
    const absPath = path.resolve(input.sourcePath);
    const cwd = process.cwd();
    // Enforce that the resolved path stays within cwd
    if (!absPath.startsWith(cwd + path.sep) && absPath !== cwd) {
        throw new Error(`Path traversal rejected: "${absPath}" is outside the working directory "${cwd}"`);
    }
    if (input.dryRun) {
        return { applied: false, path: absPath, preview: input.patch };
    }
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, input.patch, "utf-8");
    return { applied: true, path: absPath };
}
//# sourceMappingURL=apply_contract_patch.js.map