import { Link, useLocation } from "react-router-dom";
import { useWorkflowContext } from "../context/WorkflowContext";
import styles from "./StepNav.module.css";

const STEPS = [
  { path: "/",         label: "Analyze",  icon: "⚡" },
  { path: "/graph",    label: "Graph",    icon: "🔗" },
  { path: "/findings", label: "Findings", icon: "🔍" },
  { path: "/explain",  label: "Explain",  icon: "🤖" },
  { path: "/repair",   label: "Repair",   icon: "🔧" },
  { path: "/verify",   label: "Verify",   icon: "✅" },
  { path: "/evidence", label: "Evidence", icon: "📋" },
] as const;

export function StepNav(): JSX.Element {
  const { pathname } = useLocation();
  const { state } = useWorkflowContext();
  const hasResult = state.result !== null;

  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        <span className={styles.logo}>⬡</span>
        <span className={styles.name}>ContractWeave</span>
      </div>
      <ol className={styles.steps}>
        {STEPS.map((step, i) => {
          const isActive = pathname === step.path;
          const isEnabled = i === 0 || hasResult;
          return (
            <li key={step.path} className={styles.step}>
              {isEnabled ? (
                <Link
                  to={step.path}
                  className={`${styles.link} ${isActive ? styles.active : ""}`}
                >
                  <span className={styles.icon}>{step.icon}</span>
                  <span className={styles.label}>{step.label}</span>
                </Link>
              ) : (
                <span className={`${styles.link} ${styles.disabled}`}>
                  <span className={styles.icon}>{step.icon}</span>
                  <span className={styles.label}>{step.label}</span>
                </span>
              )}
              {i < STEPS.length - 1 && <span className={styles.arrow}>›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
