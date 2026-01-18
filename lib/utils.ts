/**
 * Utility functions
 */

/**
 * Safe default analysis JSON for when analysis fails
 * Matches the schema expected by the frontend and returned by the analyzer
 */
export function getSafeDefaultAnalysis(): any {
  return {
    goalInferred: "",
    workspaces: [],
    resumeSummary: "Session captured. Resume when ready.",
    lastStop: { label: "Unknown", url: "" },
    nextActions: [],
    pendingDecisions: []
  }
}
