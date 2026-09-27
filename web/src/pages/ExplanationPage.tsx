import { useNavigate } from "react-router-dom";
import { useWorkflow } from "../hooks/useWorkflow";
import { SeverityBadge } from "../components/SeverityBadge";
import styles from "./PageShared.module.css";

export function ExplanationPage(): JSX.Element {
  const { result, isPartial } = useWorkflow();
  const navigate = useNavigate();

  if (!result) {
    return <div className={styles.empty}>No analysis result yet. <button className={styles.link} onClick={() => navigate("/")}>Run an analysis first →</button></div>;
  }

  const entries = Object.entries(result.explanations);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>AI Explanations</h2>
        <p className={styles.pageDesc}>
          {isPartial
            ? "LLM was unavailable during this run — no explanations generated."
            : `${entries.length} explanation${entries.length !== 1 ? "s" : ""} from watsonx.ai · Granite 3.3`}
        </p>
      </div>

      {isPartial && (
        <div className={styles.warning}>
          ⚠ This was a partial run (LLM unavailable). Re-run with watsonx credentials to see AI explanations.
        </div>
      )}

      {entries.length === 0 && !isPartial ? (
        <div className={styles.clean}>No findings to explain.</div>
      ) : (
        <div className={styles.cardList}>
          {entries.map(([nodeId, analysis]) => {
            const finding = result.report.findings.find((f) => f.nodeId === nodeId);
            return (
              <div key={nodeId} className={styles.card}>
                <div className={styles.cardHead}>
                  <SeverityBadge severity={analysis.risk} />
                  <code className={styles.nodeId}>{nodeId}</code>
                  {finding && <span className={styles.nodeKind}>{finding.nodeKind}</span>}
                </div>
                <p className={styles.explanation}>{analysis.explanation}</p>
                <div className={styles.remediation}>
                  <span className={styles.remediationLabel}>Remediation</span>
                  <p>{analysis.remediationRationale}</p>
                </div>
                {analysis.affectedContracts.length > 0 && (
                  <div className={styles.consumers}>
                    Affected contracts: {analysis.affectedContracts.join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button className={styles.nextBtn} onClick={() => navigate("/repair")}>
        View Repairs →
      </button>
    </div>
  );
}
