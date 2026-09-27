import type { DriftSeverity } from "../types/contracts";
import styles from "./SeverityBadge.module.css";

interface Props {
  severity: DriftSeverity | "CLEAN";
  size?: "sm" | "md";
}

export function SeverityBadge({ severity, size = "md" }: Props): JSX.Element {
  return (
    <span className={`${styles.badge} ${styles[severity.toLowerCase()]} ${styles[size]}`}>
      {severity}
    </span>
  );
}
