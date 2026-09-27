import { useCallback } from "react";
import { useWorkflowContext } from "../context/WorkflowContext";
import { runWorkflow } from "../api/client";
import type { WorkflowResultWithToken } from "../types/contracts";

export interface UseWorkflowReturn {
  status: "idle" | "analyzing" | "complete" | "error";
  result: WorkflowResultWithToken | null;
  error: string | null;
  isPartial: boolean;
  baselinePaths: string[];
  currentPaths: string[];
  run: (baselinePaths: string[], currentPaths: string[]) => Promise<void>;
  reset: () => void;
}

export function useWorkflow(): UseWorkflowReturn {
  const { state, dispatch } = useWorkflowContext();

  const run = useCallback(
    async (baselinePaths: string[], currentPaths: string[]) => {
      dispatch({ type: "START", baselinePaths, currentPaths });
      try {
        const response = await runWorkflow({ baselinePaths, currentPaths });
        if (response.status === "error") {
          dispatch({ type: "ERROR", error: response.message ?? "Unknown error" });
          return;
        }
        dispatch({
          type: "COMPLETE",
          result: response.result,
          isPartial: response.status === "partial",
        });
      } catch (err) {
        dispatch({ type: "ERROR", error: String(err) });
      }
    },
    [dispatch]
  );

  const reset = useCallback(() => dispatch({ type: "RESET" }), [dispatch]);

  return {
    status: state.status,
    result: state.result,
    error: state.error,
    isPartial: state.isPartial,
    baselinePaths: state.baselinePaths,
    currentPaths: state.currentPaths,
    run,
    reset,
  };
}
