import { URL } from 'url'

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    let domain = parsed.hostname
    // Remove www. prefix
    if (domain.startsWith('www.')) {
      domain = domain.substring(4)
    }
    return domain.toLowerCase()
  } catch {
    return 'unknown'
  }
}

/**
 * Safe default analysis JSON for when analysis fails
 */
export function getSafeDefaultAnalysis(): any {
  return {
    resumeSummary: "Session captured. Resume when ready.",
    workspaces: [],
    nextActions: [],
    pendingDecisions: [],
    goalInferred: "",
    lastStop: { label: "Unknown", url: "" }
  }
}

/**
 * Validate and sanitize analysis JSON
 */
export function sanitizeAnalysis(analysis: any): any {
  if (!analysis || typeof analysis !== 'object') {
    return getSafeDefaultAnalysis()
  }

  // Ensure required fields exist
  const safe = {
    resumeSummary: analysis.resumeSummary || "Session captured. Resume when ready.",
    workspaces: Array.isArray(analysis.workspaces) ? analysis.workspaces : [],
    nextActions: Array.isArray(analysis.nextActions) ? analysis.nextActions : [],
    pendingDecisions: Array.isArray(analysis.pendingDecisions) ? analysis.pendingDecisions : [],
    goalInferred: analysis.goalInferred || "",
    lastStop: analysis.lastStop && typeof analysis.lastStop === 'object' 
      ? analysis.lastStop 
      : { label: "Unknown", url: "" }
  }

  return safe
}
