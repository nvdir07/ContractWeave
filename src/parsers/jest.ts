import * as fs from "fs";
import * as path from "path";
import { nodeId, contentDigest } from "../graph/hash";
import type { ContractNode } from "../graph/types";

interface JestMeta {
  describes: string[];
  tests: string[];
  total: number;
}

/**
 * Structural parser for Jest test files.
 * Extracts describe/it/test names — does not execute tests.
 */
export function parseJestFile(filePath: string): ContractNode {
  const absPath = path.resolve(filePath);
  const source = fs.readFileSync(absPath, "utf-8");

  const meta = extractJestMeta(source);
  const id = nodeId("jest-test", absPath);
  const digest = contentDigest(meta as unknown as Record<string, unknown>);

  return {
    id,
    kind: "jest-test",
    sourcePath: absPath,
    digest,
    label: path.basename(filePath),
    meta: meta as unknown as Record<string, unknown>,
  };
}

function extractJestMeta(source: string): JestMeta {
  const describes: string[] = [];
  const tests: string[] = [];

  const describeRe = /describe\s*\(\s*['"`]([^'"`]+)['"`]/g;
  const testRe = /(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;

  let m: RegExpExecArray | null;
  while ((m = describeRe.exec(source)) !== null) describes.push(m[1]);
  while ((m = testRe.exec(source)) !== null) tests.push(m[1]);

  return { describes, tests, total: tests.length };
}
