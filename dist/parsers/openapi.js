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
exports.parseOpenApi = parseOpenApi;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const hash_1 = require("../graph/hash");
function parseOpenApi(filePath) {
    const absPath = path.resolve(filePath);
    const raw = fs.readFileSync(absPath, "utf-8");
    const doc = yaml.load(raw);
    const info = (doc.info ?? {});
    const paths = (doc.paths ?? {});
    const components = (doc.components ?? {});
    const schemas = (components.schemas ?? {});
    const meta = {
        title: String(info.title ?? ""),
        version: String(info.version ?? ""),
        paths: canonicalizePaths(paths),
        schemas: schemas,
    };
    const id = (0, hash_1.nodeId)("openapi", absPath);
    const digest = (0, hash_1.contentDigest)(meta);
    return {
        id,
        kind: "openapi",
        sourcePath: absPath,
        digest,
        label: meta.title || path.basename(filePath),
        meta: meta,
    };
}
/**
 * Extract the structurally relevant parts of each path operation for diffing:
 * method, parameters names+required, response schema properties.
 */
function canonicalizePaths(paths) {
    const result = {};
    for (const [route, methods] of Object.entries(paths)) {
        result[route] = {};
        if (!methods || typeof methods !== "object")
            continue;
        for (const [method, operation] of Object.entries(methods)) {
            const op = operation;
            result[route][method] = {
                parameters: extractParams(op.parameters),
                responses: extractResponses(op.responses),
                requestBody: extractRequestBody(op.requestBody),
            };
        }
    }
    return result;
}
function extractParams(params) {
    if (!Array.isArray(params))
        return [];
    return params.map((p) => ({
        name: p.name,
        in: p.in,
        required: p.required ?? false,
        schema: p.schema,
    }));
}
function extractResponses(responses) {
    if (!responses || typeof responses !== "object")
        return {};
    const result = {};
    for (const [code, resp] of Object.entries(responses)) {
        const r = resp;
        const content = r.content;
        const schema = content?.["application/json"]
            ? content["application/json"].schema
            : undefined;
        result[code] = { schema };
    }
    return result;
}
function extractRequestBody(body) {
    if (!body || typeof body !== "object")
        return null;
    const b = body;
    const content = b.content;
    return content?.["application/json"]
        ? content["application/json"].schema
        : null;
}
//# sourceMappingURL=openapi.js.map