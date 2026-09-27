import { execSync } from "child_process";
import * as path from "path";
import type { RunContractTestsInput, RunContractTestsOutput } from "../../graph/types";

/**
 * run_contract_tests — executes Jest for the given file paths and returns
 * a structured pass/fail result. Never throws on test failure — returns the
 * failure details in the output.
 */
export function runContractTests(input: RunContractTestsInput): RunContractTestsOutput {
  const pattern = input.testPattern ?? buildPattern(input.paths);
  const cwd = process.cwd();

  try {
    const stdout = execSync(
      `npx jest --testPathPattern="${escapePattern(pattern)}" --json --no-coverage`,
      { cwd, encoding: "utf-8", timeout: 120_000 }
    );

    const result = JSON.parse(stdout) as JestJsonResult;
    return parseJestResult(result, stdout);
  } catch (err) {
    // Jest exits with code 1 on test failures — stdout still contains JSON
    const raw = err instanceof Error ? (err as NodeJS.ErrnoException & { stdout?: string }).stdout ?? "" : "";
    try {
      const result = JSON.parse(raw) as JestJsonResult;
      return parseJestResult(result, raw);
    } catch {
      return {
        passed: false,
        total: 0,
        failures: [{ test: "jest execution", error: String(err) }],
        stdout: raw,
      };
    }
  }
}

function buildPattern(paths: string[]): string {
  return paths
    .filter((p) => p.endsWith(".test.ts") || p.endsWith(".spec.ts"))
    .map((p) => path.resolve(p).replace(/\\/g, "/"))
    .join("|");
}

function escapePattern(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface JestJsonResult {
  numPassedTests: number;
  numFailedTests: number;
  numTotalTests: number;
  testResults?: Array<{
    testFilePath?: string;
    testResults?: Array<{
      fullName: string;
      status: string;
      failureMessages?: string[];
    }>;
  }>;
}

function parseJestResult(result: JestJsonResult, stdout: string): RunContractTestsOutput {
  const failures: Array<{ test: string; error: string }> = [];

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
