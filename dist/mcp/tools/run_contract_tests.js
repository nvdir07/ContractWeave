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
exports.runContractTests = runContractTests;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
/**
 * run_contract_tests — executes Jest for the given file paths and returns
 * a structured pass/fail result. Never throws on test failure — returns the
 * failure details in the output.
 */
function runContractTests(input) {
    const pattern = input.testPattern ?? buildPattern(input.paths);
    const cwd = process.cwd();
    try {
        const stdout = (0, child_process_1.execSync)(`npx jest --testPathPattern="${escapePattern(pattern)}" --json --no-coverage`, { cwd, encoding: "utf-8", timeout: 120_000 });
        const result = JSON.parse(stdout);
        return parseJestResult(result, stdout);
    }
    catch (err) {
        // Jest exits with code 1 on test failures — stdout still contains JSON
        const raw = err instanceof Error ? err.stdout ?? "" : "";
        try {
            const result = JSON.parse(raw);
            return parseJestResult(result, raw);
        }
        catch {
            return {
                passed: false,
                total: 0,
                failures: [{ test: "jest execution", error: String(err) }],
                stdout: raw,
            };
        }
    }
}
function buildPattern(paths) {
    return paths
        .filter((p) => p.endsWith(".test.ts") || p.endsWith(".spec.ts"))
        .map((p) => path.resolve(p).replace(/\\/g, "/"))
        .join("|");
}
function escapePattern(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function parseJestResult(result, stdout) {
    const failures = [];
    for (const file of result.testResults ?? []) {
        for (const t of file.testResults ?? []) {
            if (t.status === "failed") {
                failures.push({
                    test: t.fullName,
                    error: (t.failureMessages ?? []).join("\n"),
                });
            }
        }
    }
    return {
        passed: result.numFailedTests === 0,
        total: result.numTotalTests,
        failures,
        stdout,
    };
}
//# sourceMappingURL=run_contract_tests.js.map