import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkflow } from "../hooks/useWorkflow";
import styles from "./DashboardPage.module.css";

const DEMO_BASELINE = ["fixtures/v1/openapi.yaml", "fixtures/v1/user.schema.ts"];
const DEMO_CURRENT  = ["fixtures/v2/openapi.yaml", "fixtures/v2/user.schema.ts"];

export function DashboardPage(): JSX.Element {
  const { run, status, result, error, isPartial, reset } = useWorkflow();
  const navigate = useNavigate();
  const [baseline, setBaseline] = useState(DEMO_BASELINE.join("\n"));
  const [current, setCurrent]   = useState(DEMO_CURRENT.join("\n"));

  const handleRun = async () => {
    const bPaths = baseline.split("\n").map((s) => s.trim()).filter(Boolean);
    const cPaths  = current.split("\n").map((s) => s.trim()).filter(Boolean);
    await run(bPaths, cPaths);
  };

  const isRunning = status === "analyzing";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>ContractWeave</h1>
        <p className={styles.subtitle}>Semantic contract integrity for TypeScript · Powered by watsonx.ai</p>
      </div>

      {/* Run form */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Analyze Release</h2>
        <div className={styles.formRow}>
          <label className={styles.label}>
            Baseline artifact paths <span className={styles.hint}>(one per line)</span>
          </label>
          <textarea
            className={styles.textarea}
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
            rows={3}
            disabled={isRunning}
          />
        </div>
        <div className={styles.formRow}>
          <label className={styles.label}>
            Current artifact paths <span className={styles.hint}>(one per line)</span>
          </label>
          <textarea
            className={styles.textarea}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            rows={3}
            disabled={isRunning}
          />
        </div>
        <div className={styles.actions}>
          <button
            className={styles.primaryBtn}
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? "⏳ Analyzing…" : "⚡ Analyze Release"}
          </button>
          {result && (
            <button className={styles.secondaryBtn} onClick={() => { reset(); }}>
              ↺ Run Again
            </button>
          )}
        </div>
        {error && <div className={styles.error}>⚠ {error}</div>}
        {isPartial && (
          <div className={styles.warning}>
            ⚠ LLM unavailable — showing deterministic analysis only (no explanations or repairs).
          </div>
        )}
      </div>

      {/* Summary after run */}
      {result && (
        <div className={styles.summary}>
          <div className={styles.summaryHeader}>
            <span className={styles.summaryTitle}>Run complete</span>
            <span className={styles.runId}>ID: {result.report.runId}</span>
            <span className={styles.timestamp}>{new Date(result.report.timestamp).toLocaleString()}</span>
          </div>
          <div className={styles.stats}>
            <Stat label="Artifacts scanned" value={result.report.scannedPaths.length} />
            <Stat label="Graph nodes" value={result.report.graph.nodes.length} />
            <Stat label="Findings" value={result.report.findings.length} color={result.report.findings.length > 0 ? "var(--warning)" : "var(--clean)"} />
            <Stat label="Breaking" value={result.report.findings.filter((f) => f.severity === "BREAKING").length} color="var(--breaking)" />
            <Stat label="Passed" value={result.evidence.passed ? "YES" : "NO"} color={result.evidence.passed ? "var(--clean)" : "var(--breaking)"} />
          </div>
          <div className={styles.navHint}>
            Use the steps above to explore the contract graph, findings, AI explanations, and release evidence.
          </div>
          <button className={styles.primaryBtn} onClick={() => navigate("/graph")}>
            View Contract Graph →
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }): JSX.Element {
  return (
    <div className={styles.stat}>
      <span className={styles.statVal} style={color ? { color } : {}}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
