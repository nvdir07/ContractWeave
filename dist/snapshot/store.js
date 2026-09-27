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
exports.SnapshotStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SnapshotStore {
    snapshots = new Map();
    record(node) {
        this.snapshots.set(node.id, {
            nodeId: node.id,
            digest: node.digest,
            capturedAt: new Date().toISOString(),
        });
    }
    getSnapshot(nodeId) {
        return this.snapshots.get(nodeId);
    }
    /**
     * Returns true if the node's digest differs from the recorded snapshot.
     * Returns true (drifted) if no snapshot exists yet (first-time node).
     */
    hasDrifted(node) {
        const snap = this.snapshots.get(node.id);
        if (!snap)
            return false; // no baseline = nothing to compare
        return snap.digest !== node.digest;
    }
    all() {
        return Array.from(this.snapshots.values());
    }
    save(filePath) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const data = { snapshots: Object.fromEntries(this.snapshots) };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    }
    static load(filePath) {
        const store = new SnapshotStore();
        if (!fs.existsSync(filePath))
            return store;
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        for (const snap of Object.values(data.snapshots)) {
            store.snapshots.set(snap.nodeId, snap);
        }
        return store;
    }
}
exports.SnapshotStore = SnapshotStore;
//# sourceMappingURL=store.js.map