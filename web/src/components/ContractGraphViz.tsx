import type { ContractNode, ContractEdge } from "../types/contracts";
import styles from "./ContractGraphViz.module.css";
import { useState } from "react";

interface Props {
  nodes: ContractNode[];
  edges: ContractEdge[];
}

// Lane order for layout
const KIND_ORDER = ["openapi", "zod-schema", "jest-test", "fixture", "doc", "event-schema", "ts-type"] as const;
const KIND_LABELS: Record<string, string> = {
  "openapi": "OpenAPI",
  "zod-schema": "Zod Schema",
  "jest-test": "Jest Tests",
  "fixture": "Fixtures",
  "doc": "Docs",
  "event-schema": "Events",
  "ts-type": "TS Types",
};

const SVG_W = 720;
const SVG_H = 340;
const NODE_R = 28;
const LANE_H = SVG_H;
const PADDING = 60;

function layoutNodes(nodes: ContractNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  // Group by kind
  const byKind = new Map<string, ContractNode[]>();
  for (const node of nodes) {
    const list = byKind.get(node.kind) ?? [];
    list.push(node);
    byKind.set(node.kind, list);
  }

  const kinds = KIND_ORDER.filter((k) => byKind.has(k));
  const laneW = kinds.length > 0 ? (SVG_W - PADDING * 2) / kinds.length : SVG_W;

  kinds.forEach((kind, ki) => {
    const laneNodes = byKind.get(kind) ?? [];
    const laneX = PADDING + ki * laneW + laneW / 2;
    laneNodes.forEach((node, ni) => {
      const laneY = PADDING + ((LANE_H - PADDING * 2) / Math.max(laneNodes.length, 1)) * (ni + 0.5);
      positions.set(node.id, { x: laneX, y: laneY });
    });
  });

  return positions;
}

const KIND_COLORS: Record<string, string> = {
  "openapi":      "#5c6ef5",
  "zod-schema":   "#4caf83",
  "jest-test":    "#f5a623",
  "fixture":      "#4db6e8",
  "doc":          "#8b90b0",
  "event-schema": "#f04459",
  "ts-type":      "#a78bfa",
};

export function ContractGraphViz({ nodes, edges }: Props): JSX.Element {
  const [selected, setSelected] = useState<ContractNode | null>(null);
  const positions = layoutNodes(nodes);

  return (
    <div className={styles.wrapper}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className={styles.svg} aria-label="Contract graph">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="var(--border)" />
          </marker>
        </defs>

        {/* Lane labels */}
        {KIND_ORDER.filter((k) => nodes.some((n) => n.kind === k)).map((kind, ki) => {
          const kindCount = nodes.filter((n) => n.kind === kind).length;
          const laneW = (SVG_W - PADDING * 2) / KIND_ORDER.filter((k) => nodes.some((n) => n.kind === k)).length;
          const laneX = PADDING + ki * laneW + laneW / 2;
          return (
            <text key={kind} x={laneX} y={18} textAnchor="middle" fontSize={10} fill="var(--muted)">
              {KIND_LABELS[kind]} ({kindCount})
            </text>
          );
        })}

        {/* Edges */}
        {edges.map((edge, i) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          // Offset line endpoints to node radius
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const x1 = from.x + (dx / len) * NODE_R;
          const y1 = from.y + (dy / len) * NODE_R;
          const x2 = to.x - (dx / len) * (NODE_R + 8);
          const y2 = to.y - (dy / len) * (NODE_R + 8);
          return (
            <g key={i}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="var(--border)" strokeWidth={1.5}
                markerEnd="url(#arrow)"
                strokeDasharray={edge.rel === "tests" ? "4 3" : undefined}
              />
              <text
                x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4}
                fontSize={9} fill="var(--muted)" textAnchor="middle"
              >
                {edge.rel}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const color = KIND_COLORS[node.kind] ?? "#8b90b0";
          const isSelected = selected?.id === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${pos.x},${pos.y})`}
              className={styles.node}
              onClick={() => setSelected(isSelected ? null : node)}
              role="button"
              aria-label={node.label}
            >
              <circle
                r={NODE_R}
                fill={`${color}22`}
                stroke={isSelected ? color : `${color}88`}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              <text fontSize={9} textAnchor="middle" dy={3} fill={color} fontWeight={600}>
                {node.label.length > 12 ? node.label.slice(0, 11) + "…" : node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Node detail panel */}
      {selected && (
        <div className={styles.detail}>
          <button className={styles.close} onClick={() => setSelected(null)}>✕</button>
          <div className={styles.detailKind}>{KIND_LABELS[selected.kind] ?? selected.kind}</div>
          <div className={styles.detailLabel}>{selected.label}</div>
          <div className={styles.detailRow}>
            <span className={styles.detailKey}>ID</span>
            <code className={styles.detailVal}>{selected.id}</code>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailKey}>Digest</span>
            <code className={styles.detailVal}>{selected.digest}</code>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailKey}>Path</span>
            <code className={styles.detailVal}>{selected.sourcePath.split(/[/\\]/).slice(-2).join("/")}</code>
          </div>
        </div>
      )}
    </div>
  );
}
