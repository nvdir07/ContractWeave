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
exports.parseZodSchema = parseZodSchema;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const hash_1 = require("../graph/hash");
/**
 * Regex-based Zod schema parser.
 * Extracts fields from z.object({ ... }) declarations without a full TS compiler.
 * Sufficient for drift detection on field presence and optionality.
 */
function parseZodSchema(filePath) {
    const absPath = path.resolve(filePath);
    const source = fs.readFileSync(absPath, "utf-8");
    const meta = extractZodMeta(source, absPath);
    const id = (0, hash_1.nodeId)("zod-schema", absPath);
    const digest = (0, hash_1.contentDigest)(meta);
    return {
        id,
        kind: "zod-schema",
        sourcePath: absPath,
        digest,
        label: meta.schemaName || path.basename(filePath),
        meta: meta,
    };
}
function extractZodMeta(source, filePath) {
    // Find exported schema name: export const FooSchema = ...
    const nameMatch = source.match(/export\s+const\s+(\w+)\s*=/);
    const schemaName = nameMatch ? nameMatch[1] : path.basename(filePath, ".ts");
    const fields = {};
    // Match z.object({ ... }) block — handles single-level only for MVP
    const objectMatch = source.match(/z\.object\(\s*\{([\s\S]*?)\}\s*\)/);
    if (objectMatch) {
        const body = objectMatch[1];
        // Each line like:  fieldName: z.string().optional(),
        const fieldRe = /(\w+)\s*:\s*(z\.[^,\n]+)/g;
        let m;
        while ((m = fieldRe.exec(body)) !== null) {
            const name = m[1];
            const expr = m[2].trim();
            fields[name] = {
                type: extractZodType(expr),
                optional: expr.includes(".optional()"),
                nullable: expr.includes(".nullable()"),
            };
        }
    }
    return { schemaName, fields };
}
function extractZodType(expr) {
    // Extract base type: z.string(), z.number(), z.boolean(), z.array(...), z.object(...)
    const base = expr.match(/z\.(\w+)/);
    return base ? base[1] : "unknown";
}
//# sourceMappingURL=zod.js.map