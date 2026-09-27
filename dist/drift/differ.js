"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffMeta = diffMeta;
/**
 * Deep-diff two plain objects, emitting FieldChange[] with JSON-pointer paths.
 * Operates purely on the parsed `meta` — never touches source files.
 */
function diffMeta(oldMeta, newMeta, basePath = "") {
    const changes = [];
    diffObjects(oldMeta, newMeta, basePath, changes);
    return changes;
}
function diffObjects(oldObj, newObj, basePath, out) {
    const oldKeys = new Set(Object.keys(oldObj));
    const newKeys = new Set(Object.keys(newObj));
    // Removed keys
    for (const key of oldKeys) {
        if (!newKeys.has(key)) {
            out.push(change("removed", `${basePath}/${key}`, oldObj[key], undefined));
        }
    }
    // Added keys
    for (const key of newKeys) {
        if (!oldKeys.has(key)) {
            out.push(change("added", `${basePath}/${key}`, undefined, newObj[key]));
        }
    }
    // Changed keys — recurse into objects
    for (const key of oldKeys) {
        if (!newKeys.has(key))
            continue;
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        const currentPath = `${basePath}/${key}`;
        if (isPlainObject(oldVal) && isPlainObject(newVal)) {
            diffObjects(oldVal, newVal, currentPath, out);
        }
        else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            const kind = classifyChange(key, oldVal, newVal);
            out.push(change(kind, currentPath, oldVal, newVal));
        }
    }
}
function classifyChange(key, oldVal, newVal) {
    // Optionality change detection on "optional" boolean fields (Zod meta)
    if (key === "optional") {
        if (oldVal === false && newVal === true)
            return "type-widened";
        if (oldVal === true && newVal === false)
            return "type-narrowed";
    }
    // Type field on Zod meta
    if (key === "type") {
        return "changed";
    }
    return "changed";
}
function change(kind, path, oldVal, newVal) {
    return { path, kind, oldVal, newVal };
}
function isPlainObject(val) {
    return typeof val === "object" && val !== null && !Array.isArray(val);
}
//# sourceMappingURL=differ.js.map