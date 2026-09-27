"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreChanges = scoreChanges;
/**
 * Deterministic severity rules. No LLM involved.
 *
 * Rules (applied in order):
 *   Removed required field               → BREAKING
 *   Type narrowed                        → BREAKING
 *   Required field added to response     → BREAKING (consumers didn't expect it as required)
 *   Type widened (optional added)        → WARNING
 *   Non-required field removed from req  → WARNING
 *   Added optional field                 → INFO
 *   Any other change                     → INFO
 */
function scoreChanges(node, changes, affectedConsumers) {
    const severity = computeSeverity(node, changes);
    const message = summarize(node, changes, severity);
    return {
        nodeId: node.id,
        nodePath: node.sourcePath,
        nodeKind: node.kind,
        changes,
        severity,
        message,
        affectedConsumers,
    };
}
function computeSeverity(node, changes) {
    // Escalate through severities
    let severity = "INFO";
    for (const c of changes) {
        const s = ruleFor(node, c);
        if (s === "BREAKING")
            return "BREAKING";
        if (s === "WARNING" && severity === "INFO")
            severity = "WARNING";
    }
    return severity;
}
function ruleFor(node, c) {
    const path = c.path.toLowerCase();
    // Zod schema: optional field widening
    if (c.kind === "type-widened")
        return "WARNING";
    if (c.kind === "type-narrowed")
        return "BREAKING";
    // Removed fields
    if (c.kind === "removed") {
        // OpenAPI response schema field removed → breaking for consumers
        if (node.kind === "openapi" && (path.includes("/response") || path.includes("/schema"))) {
            return "BREAKING";
        }
        // Zod field removed → breaking
        if (node.kind === "zod-schema" && path.includes("/fields/")) {
            return "BREAKING";
        }
        return "WARNING";
    }
    // Added required field to response (OpenAPI) → breaking consumers
    if (c.kind === "added") {
        const parentPath = c.path.split("/").slice(0, -1).join("/").toLowerCase();
        if (node.kind === "openapi" &&
            parentPath.includes("responses") &&
            isRequiredField(c.newVal)) {
            return "BREAKING";
        }
        return "INFO";
    }
    return "INFO";
}
function isRequiredField(val) {
    if (!val || typeof val !== "object")
        return false;
    const v = val;
    return v.required === true;
}
function summarize(node, changes, severity) {
    const counts = { added: 0, removed: 0, changed: 0, widened: 0, narrowed: 0 };
    for (const c of changes) {
        if (c.kind === "added")
            counts.added++;
        else if (c.kind === "removed")
            counts.removed++;
        else if (c.kind === "type-widened")
            counts.widened++;
        else if (c.kind === "type-narrowed")
            counts.narrowed++;
        else
            counts.changed++;
    }
    const parts = [];
    if (counts.removed > 0)
        parts.push(`${counts.removed} field(s) removed`);
    if (counts.added > 0)
        parts.push(`${counts.added} field(s) added`);
    if (counts.narrowed > 0)
        parts.push(`${counts.narrowed} type(s) narrowed`);
    if (counts.widened > 0)
        parts.push(`${counts.widened} type(s) widened`);
    if (counts.changed > 0)
        parts.push(`${counts.changed} value(s) changed`);
    const detail = parts.length > 0 ? parts.join(", ") : "no changes";
    return `[${severity}] ${node.kind} ${node.label}: ${detail}`;
}
//# sourceMappingURL=scorer.js.map