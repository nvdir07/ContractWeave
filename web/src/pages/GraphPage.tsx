import { useNavigate } from "react-router-dom";
import { useWorkflow } from "../hooks/useWorkflow";
import { ContractGraphViz } from "../components/ContractGraphViz";
import styles from "./PageShared.module.css";

export function GraphPage(): JSX.Element {
  const { result } = useWorkflow();
  const navigate = useNavigate();

  if (!result) {
    return <div className={styles.empty}>No analysis result yet. <button className={styles.link} onClick={() => navigate("/")}>Run an analysis first →</button></div>;
  }

  const { nodes, edges } = result.report.graph;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Contract Graph</h2>
        <p className={styles.pageDesc}>
          {nodes.length} artifact{nodes.length !== 1 ? "s" : ""} · {edges.length} relationship{edges.length !== 1 ? "s" : ""}.
          Click a node to inspect it.
        </p>
      </div>

      <ContractGraphViz nodes={nodes} edges={edges} />

      <div className={styles.table}>
        <table className={styles.tbl}>
          <thead>
            <tr><th>Label</th><th>Kind</th><th>Digest</th><th>Path</th></tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.id}>
                <td className={styles.bold}>{n.label}</td>
                <td><code className={styles.kind}>{n.kind}</code></td>
                <td><code className={styles.mono}>{n.digest}</code></td>
                <td className={styles.path}>{n.sourcePath.split(/[/\\]/).slice(-2).join("/")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className={styles.nextBtn} onClick={() => navigate("/findings")}>
        View Drift Findings →
      </button>
    </div>
  );
}
