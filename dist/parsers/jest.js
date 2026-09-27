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
exports.parseJestFile = parseJestFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const hash_1 = require("../graph/hash");
/**
 * Structural parser for Jest test files.
 * Extracts describe/it/test names — does not execute tests.
 */
function parseJestFile(filePath) {
    const absPath = path.resolve(filePath);
    const source = fs.readFileSync(absPath, "utf-8");
    const meta = extractJestMeta(source);
    const id = (0, hash_1.nodeId)("jest-test", absPath);
    const digest = (0, hash_1.contentDigest)(meta);
    return {
        id,
        kind: "jest-test",
        sourcePath: absPath,
        digest,
        label: path.basename(filePath),
        meta: meta,
    };
}
function extractJestMeta(source) {
    const describes = [];
    const tests = [];
    const describeRe = /describe\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const testRe = /(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let m;
    while ((m = describeRe.exec(source)) !== null)
        describes.push(m[1]);
    while ((m = testRe.exec(source)) !== null)
        tests.push(m[1]);
    return { describes, tests, total: tests.length };
}
//# sourceMappingURL=jest.js.map