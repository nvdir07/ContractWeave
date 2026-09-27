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
exports.ContractGraph = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ContractGraph {
    nodes = new Map();
    edges = [];
    add(node) {
        this.nodes.set(node.id, node);
    }
    addEdge(edge) {
        const exists = this.edges.some((e) => e.from === edge.from && e.to === edge.to && e.rel === edge.rel);
        if (!exists)
            this.edges.push(edge);
    }
    getNode(id) {
        return this.nodes.get(id);
    }
    getNodeByPath(sourcePath) {
        for (const node of this.nodes.values()) {
            if (node.sourcePath === sourcePath)
                return node;
        }
        return undefined;
    }
    getConsumers(nodeId) {
        return this.edges
            .filter((e) => e.to === nodeId)
            .map((e) => this.nodes.get(e.from))
            .filter((n) => n !== undefined);
    }
    getEdgesFor(nodeId) {
        return this.edges.filter((e) => e.from === nodeId || e.to === nodeId);
    }
    allNodes() {
        return Array.from(this.nodes.values());
    }
    allEdges() {
        return [...this.edges];
    }
    toJSON() {
        return { nodes: this.allNodes(), edges: this.allEdges() };
    }
    static fromJSON(data) {
        const g = new ContractGraph();
        for (const n of data.nodes)
            g.add(n);
        for (const e of data.edges)
            g.addEdge(e);
        return g;
    }
    save(filePath) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(this.toJSON(), null, 2), "utf-8");
    }
    static load(filePath) {
        const raw = fs.readFileSync(filePath, "utf-8");
        return ContractGraph.fromJSON(JSON.parse(raw));
    }
}
exports.ContractGraph = ContractGraph;
//# sourceMappingURL=index.js.map