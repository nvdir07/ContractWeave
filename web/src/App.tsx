import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WorkflowProvider } from "./context/WorkflowContext";
import { StepNav } from "./components/StepNav";
import { DashboardPage } from "./pages/DashboardPage";
import { GraphPage } from "./pages/GraphPage";
import { FindingsPage } from "./pages/FindingsPage";
import { ExplanationPage } from "./pages/ExplanationPage";
import { RepairPage } from "./pages/RepairPage";
import { VerifyPage } from "./pages/VerifyPage";
import { EvidencePage } from "./pages/EvidencePage";
import styles from "./App.module.css";

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <WorkflowProvider>
        <div className={styles.shell}>
          <StepNav />
          <main className={styles.main}>
            <Routes>
              <Route path="/"         element={<DashboardPage />} />
              <Route path="/graph"    element={<GraphPage />} />
              <Route path="/findings" element={<FindingsPage />} />
              <Route path="/explain"  element={<ExplanationPage />} />
              <Route path="/repair"   element={<RepairPage />} />
              <Route path="/verify"   element={<VerifyPage />} />
              <Route path="/evidence" element={<EvidencePage />} />
            </Routes>
          </main>
        </div>
      </WorkflowProvider>
    </BrowserRouter>
  );
}
