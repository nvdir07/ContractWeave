import { useWorkflow } from "../hooks/useWorkflow";
import { SeverityBadge } from "../components/SeverityBadge";
import styles from "./PageShared.module.css";
import { useNavigate } from "react-router-dom";

export function EvidencePage(): JSX.Element {
  const { result } = useWorkflow();
  const navigate = useNavigate();

  if (!result) {
    return <div className={styles.empty}>No analysis result yet. <button className={styles.link} onClick={() => navigate("/")}>Run an analysis first →</button></div>;
  }

  const { evidence, approvalToken, summaryMarkdown } = result;
  const passed = evidence.passed;

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contractweave-evidence-${evidence.runId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Release Evidence</h2>
        <p className={styles.pageDesc}>Run {evidence.runId} · {new Date(evidence.timestamp).toLocaleString()}</p>
      </div>

      {/* Gate banner */}
      <div className={passed ? styles.passedBanner : styles.failedBanner}>
        <span className={styles.gateIcon}>{passed ? "✅" : "❌"}</span>
        <div>
          <div className={styles.gateStatus}>{passed ? "RELEASE GATE PASSED" : "RELEASE GATE FAILED"}</div>
          <div className={styles.gateSub}>
            {evidence.breakingCount} breaking · {evidence.warningCount} warning{evidence.warningCount !== 1 ? "s" : ""} · {evidence.patchSummary}
          </div>
        </div>
        <div className={styles.badgeImg}>
          <img
            src={`https://img.shields.io/badge/${encodeURIComponent(evidence.badge.label)}-${encodeURIComponent(evidence.badge.message)}-${evidence.badge.color}`}
            alt={`${evidence.badge.label}: ${evidence.badge.message}`}
          />
        </div>
      </div>

      {/* Approval token */}
      {approvalToken && (
        <div className={styles.tokenCard}>
          <span className={styles.tokenLabel}>Approval Token</span>
          <code className={styles.token}>{approvalToken}</code>
        </div>
      )}

      {/* SBOM table */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Contract SBOM ({evidence.sbom.length} entries)</h3>
        <div className={styles.table}>
          <table className={styles.tbl}>
            <thead>
              <tr><th>Artifact</th><th>Kind</th><th>Digest</th><th>Severity</th><th>Verified</th></tr>
            </thead>
            <tbody>
              {evidence.sbom.map((entry) => (
                <tr key={entry.nodeId}>
                  <td className={styles.path}>{entry.sourcePath.split(/[/\\]/).slice(-2).join("/")}</td>
                  <td><code className={styles.kind}>{entry.kind}</code></td>
                  <td><code className={styles.mono}>{entry.digest}</code></td>
                  <td><SeverityBadge severity={entry.severity} size="sm" /></td>
                  <td className={entry.verified ? styles.verified : styles.unverified}>
                    {entry.verified ? "✓" : "✗"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Markdown summary */}
      {summaryMarkdown && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Summary Markdown</h3>
          <pre className={styles.markdownPre}>{summaryMarkdown}</pre>
        </div>
      )}

      {/* Actions */}
      <div className={styles.evidenceActions}>
        <button className={styles.downloadBtn} onClick={handleDownload}>
          ⬇ Download Evidence JSON
        </button>
        <button className={styles.secondaryBtn} onClick={() => navigate("/")}>
          ↺ New Analysis
        </button>
      </div>
    </div>
  );
}
