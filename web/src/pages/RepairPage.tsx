import { useNavigate } from "react-router-dom";
import { useWorkflow } from "../hooks/useWorkflow";
import styles from "./PageShared.module.css";

export function RepairPage(): JSX.Element {
  const { result, isPartial } = useWorkflow();
  const navigate = useNavigate();

  if (!result) {
    return <div className={styles.empty}>No analysis result yet. <button className={styles.link} onClick={() => navigate("/")}>Run an analysis first →</button></div>;
  }

  const entries = Object.entries(result.repairs);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Repair Patches</h2>
        <p className={styles.pageDesc}>
          {isPartial
            ? "LLM was unavailable — no repairs generated."
            : `${entries.length} repair${entries.length !== 1 ? "s" : ""} proposed by watsonx.ai`}
        </p>
      </div>

      {isPartial && (
        <div className={styles.warning}>
          ⚠ Repairs require LLM. Re-run with watsonx credentials to generate repair patches.
        </div>
      )}

      {entries.length === 0 && !isPartial ? (
        <div className={styles.clean}>No repairs needed (INFO-only findings or no findings).</div>
      ) : (
        <div className={styles.cardList}>
          {entries.map(([nodeId, patch]) => {
            const finding = result.report.findings.find((f) => f.nodeId === nodeId);
            return (
              <div key={nodeId} className={styles.card}>
                <div className={styles.cardHead}>
                  <code className={styles.nodeId}>{nodeId}</code>
                  {finding && <span className={styles.nodeKind}>{finding.nodeKind}</span>}
                  {finding && <span className={styles.mono}>{finding.nodePath.split(/[/\\]/).slice(-1)[0]}</span>}
                </div>
                <div className={styles.patchLabel}>Proposed file content</div>
                <pre className={styles.patch}>{patch}</pre>
              </div>
            );
          })}
        </div>
      )}

      <button className={styles.nextBtn} onClick={() => navigate("/verify")}>
        View Verification →
      </button>
    </div>
  );
}
