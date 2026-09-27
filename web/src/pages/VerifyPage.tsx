import { useNavigate } from "react-router-dom";
import { useWorkflow } from "../hooks/useWorkflow";
import styles from "./PageShared.module.css";

export function VerifyPage(): JSX.Element {
  const { result, isPartial } = useWorkflow();
  const navigate = useNavigate();

  if (!result) {
    return <div className={styles.empty}>No analysis result yet. <button className={styles.link} onClick={() => navigate("/")}>Run an analysis first →</button></div>;
  }

  const entries = Object.entries(result.verifications);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Verification</h2>
        <p className={styles.pageDesc}>
          {isPartial
            ? "LLM was unavailable — no verifications performed."
            : `${entries.length} artifact${entries.length !== 1 ? "s" : ""} verified`}
        </p>
      </div>

      {isPartial && (
        <div className={styles.warning}>
          ⚠ Verification requires repairs to verify. Re-run with watsonx credentials.
        </div>
      )}

      {entries.length === 0 && !isPartial ? (
        <div className={styles.clean}>No repairs to verify.</div>
      ) : (
        <div className={styles.verifyList}>
          {entries.map(([nodeId, verified]) => {
            const finding = result.report.findings.find((f) => f.nodeId === nodeId);
            return (
              <div key={nodeId} className={`${styles.verifyRow} ${verified ? styles.verifyPass : styles.verifyFail}`}>
                <span className={styles.verifyIcon}>{verified ? "✓" : "✗"}</span>
                <div className={styles.verifyInfo}>
                  <span className={styles.verifyStatus}>{verified ? "CLEAN" : "RESIDUAL DRIFT"}</span>
                  {finding && <span className={styles.verifyPath}>{finding.nodePath.split(/[/\\]/).slice(-2).join("/")}</span>}
                  <code className={styles.nodeId}>{nodeId}</code>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className={styles.nextBtn} onClick={() => navigate("/evidence")}>
        View Release Evidence →
      </button>
    </div>
  );
}
