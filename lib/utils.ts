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
    resumeSummary: "Not enough signal; showing ground truth only.",
    aiRecap: "Not enough signal; showing ground truth only.",
    aiActions: [],
    aiConfidenceScore: 0,
    aiConfidenceLabel: "low",
    lastStop: { label: "Unknown", url: "" },
    nextActions: [],
    pendingDecisions: []
  }
}
