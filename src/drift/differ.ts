import type { FieldChange, FieldChangeKind } from "../graph/types";

/**
 * Deep-diff two plain objects, emitting FieldChange[] with JSON-pointer paths.
 * Operates purely on the parsed `meta` — never touches source files.
 */
export function diffMeta(
  oldMeta: Record<string, unknown>,
  newMeta: Record<string, unknown>,
  basePath = ""
): FieldChange[] {
  const changes: FieldChange[] = [];
  diffObjects(oldMeta, newMeta, basePath, changes);
  return changes;
}

function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  basePath: string,
  out: FieldChange[]
): void {
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
    if (!newKeys.has(key)) continue;
    const oldVal = oldObj[key];
    const newVal = newObj[key];
    const currentPath = `${basePath}/${key}`;

    if (isPlainObject(oldVal) && isPlainObject(newVal)) {
      diffObjects(
        oldVal as Record<string, unknown>,
        newVal as Record<string, unknown>,
        currentPath,
        out
      );
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      const kind = classifyChange(key, oldVal, newVal);
      out.push(change(kind, currentPath, oldVal, newVal));
    }
  }
}

function classifyChange(
  key: string,
  oldVal: unknown,
  newVal: unknown
): FieldChangeKind {
  // Optionality change detection on "optional" boolean fields (Zod meta)
  if (key === "optional") {
    if (oldVal === false && newVal === true) return "type-widened";
    if (oldVal === true && newVal === false) return "type-narrowed";
  }
  // Type field on Zod meta
  if (key === "type") {
    return "changed";
  }
  return "changed";
}

function change(
  kind: FieldChangeKind,
  path: string,
  oldVal: unknown,
  newVal: unknown
): FieldChange {
  return { path, kind, oldVal, newVal };
}

function isPlainObject(val: unknown): boolean {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}
