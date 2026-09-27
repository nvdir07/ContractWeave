import { useNavigate } from "react-router-dom";
import { useWorkflow } from "../hooks/useWorkflow";
import { SeverityBadge } from "../components/SeverityBadge";
import styles from "./PageShared.module.css";

export function FindingsPage(): JSX.Element {
  const { result } = useWorkflow();
  const navigate = useNavigate();

  if (!result) {
    return <div className={styles.empty}>No analysis result yet. <button className={styles.link} onClick={() => navigate("/")}>Run an analysis first →</button></div>;
  }

  const { findings } = result.report;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Drift Findings</h2>
        <p className={styles.pageDesc}>{findings.length} finding{findings.length !== 1 ? "s" : ""} across {result.report.scannedPaths.length} artifact{result.report.scannedPaths.length !== 1 ? "s" : ""}.</p>
      </div>

      {findings.length === 0 ? (
        <div className={styles.clean}>✅ All contracts are clean — no drift detected.</div>
      ) : (
        <div className={styles.cardList}>
          {findings.map((f) => (
            <div key={f.nodeId} className={styles.card}>
              <div className={styles.cardHead}>
                <SeverityBadge severity={f.severity} />
                <span className={styles.cardTitle}>{f.nodePath.split(/[/\\]/).slice(-2).join("/")}</span>
                <code className={styles.nodeKind}>{f.nodeKind}</code>
              </div>
              <p className={styles.message}>{f.message}</p>
              {f.changes.length > 0 && (
                <div className={styles.changes}>
                  <div className={styles.changesTitle}>Changes ({f.changes.length})</div>
                  {f.changes.map((ch, i) => (
                    <div key={i} className={styles.change}>
                      <span className={`${styles.changeKind} ${styles[ch.kind.replace("-", "")]}`}>{ch.kind}</span>
                      <code className={styles.changePath}>{ch.path}</code>
                    </div>
                  ))}
                </div>
              )}
              {f.affectedConsumers.length > 0 && (
                <div className={styles.consumers}>
                  Affects: {f.affectedConsumers.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button className={styles.nextBtn} onClick={() => navigate("/explain")}>
        View AI Explanations →
      </button>
    </div>
  );
}
