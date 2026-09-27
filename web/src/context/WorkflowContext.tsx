import React, { createContext, useContext, useReducer, useEffect } from "react";
import type { WorkflowResultWithToken } from "../types/contracts";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------
export interface WorkflowState {
  status: "idle" | "analyzing" | "complete" | "error";
  baselinePaths: string[];
  currentPaths: string[];
  result: WorkflowResultWithToken | null;
  error: string | null;
  isPartial: boolean; // true when LLM was unavailable and we got analyze-only
}

type WorkflowAction =
  | { type: "START"; baselinePaths: string[]; currentPaths: string[] }
  | { type: "COMPLETE"; result: WorkflowResultWithToken; isPartial: boolean }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

const STORAGE_KEY = "contractweave:last-result";

const DEFAULT_BASELINE = [
  "fixtures/v1/openapi.yaml",
  "fixtures/v1/user.schema.ts",
];
const DEFAULT_CURRENT = [
  "fixtures/v2/openapi.yaml",
  "fixtures/v2/user.schema.ts",
];

function initialState(): WorkflowState {
  // Rehydrate from localStorage so demo pages survive refresh
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as WorkflowState;
      return { ...saved, status: "complete" };
    }
  } catch {
    // ignore parse errors
  }
  return {
    status: "idle",
    baselinePaths: DEFAULT_BASELINE,
    currentPaths: DEFAULT_CURRENT,
    result: null,
    error: null,
    isPartial: false,
  };
}

function reducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case "START":
      return {
        ...state,
        status: "analyzing",
        baselinePaths: action.baselinePaths,
        currentPaths: action.currentPaths,
        result: null,
        error: null,
        isPartial: false,
      };
    case "COMPLETE":
      return {
        ...state,
        status: "complete",
        result: action.result,
        isPartial: action.isPartial,
        error: null,
      };
    case "ERROR":
      return { ...state, status: "error", error: action.error };
    case "RESET":
      return {
        status: "idle",
        baselinePaths: state.baselinePaths,
        currentPaths: state.currentPaths,
        result: null,
        error: null,
        isPartial: false,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface WorkflowContextValue {
  state: WorkflowState;
  dispatch: React.Dispatch<WorkflowAction>;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function WorkflowProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // Persist to localStorage whenever result changes
  useEffect(() => {
    if (state.result) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // quota exceeded — ignore
      }
    }
  }, [state.result]);

  return (
    <WorkflowContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflowContext(): WorkflowContextValue {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error("useWorkflowContext must be used inside WorkflowProvider");
  return ctx;
}
