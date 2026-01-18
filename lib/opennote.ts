/**
 * Opennote API Client
 * Handles journal export and practice set generation
 */

interface SessionData {
  session: {
    id: string
    started_at: string
    ended_at?: string | null
    intent_text?: string | null
  }
  events: Array<{
    url: string
    title?: string | null
    duration_sec?: number | null
    domain?: string | null
    ts: string
  }>
  analysis?: {
    resumeSummary?: string
    aiRecap?: string
    aiActions?: string[]
    aiConfidenceLabel?: "high" | "medium" | "low"
    workspaces?: Array<{ label: string; timeSec: number; topUrls: string[] }>
    lastStop?: { label: string; url: string }
    nextActions?: string[]
    pendingDecisions?: string[]
    goalInferred?: string
    mostActiveWorkspace?: { label: string; timeSec: number }
    topPages?: Array<{ title?: string; url: string; domain?: string; timeSec?: number }>
    alignment?: {
      alignedSec: number
      offIntentSec: number
      neutralSec: number
      unknownSec: number
      alignedPct?: number
    }
    aiConfidence?: "high" | "medium" | "low"
  } | null
}

/**
 * Generate markdown report from session data
 * This creates a clean, readable journal entry
 */
export function generateSessionMarkdown(data: SessionData): string {
  const { session, events, analysis } = data
  const startDate = new Date(session.started_at)
  const dateStr = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })

  const intent = (session.intent_text || analysis?.goalInferred || "").trim()
  const mostActive = analysis?.mostActiveWorkspace
  const lastStop = analysis?.lastStop?.url
    ? analysis.lastStop
    : (events.length ? { label: events[events.length - 1].title || "Last visited page", url: events[events.length - 1].url } : null)

  const workspaces = analysis?.workspaces || []
  const topWorkspace = workspaces[0]
  const topUrls = topWorkspace?.topUrls?.slice(0, 3) || []
  const confidence = analysis?.aiConfidence || analysis?.aiConfidenceLabel || inferConfidence(analysis)

  let md = `# FocusForge — Session Recap (${dateStr})\n\n`

  // TL;DR
  md += `## TL;DR\n\n`
  if (topWorkspace?.label) {
    md += `You mostly worked in **${topWorkspace.label}**. `
  } else {
    md += `Session recap from your recent browsing. `
  }
  if (lastStop?.label) md += `Last stop: **${lastStop.label}**.\n\n`
  else md += `\n\n`

  // Intent (user provided)
  if (intent) {
    md += `## Intent (what you said you wanted to do)\n\n${intent}\n\n`
  }

  // Ground Truth (deterministic)
  md += `## Ground Truth (deterministic)\n\n`
  if (mostActive?.label) {
    md += `- **Most active workspace:** ${mostActive.label} (${formatTime(mostActive.timeSec)})\n`
  } else if (topWorkspace?.label) {
    md += `- **Most active workspace:** ${topWorkspace.label} (${formatTime(topWorkspace.timeSec)})\n`
  }

  if (lastStop?.url) {
    md += `- **Last stop:** [${lastStop.label}](${lastStop.url})\n`
  }

  // Top pages (best effort)
  const pages = analysis?.topPages?.slice(0, 5)
  if (pages?.length) {
    md += `\n**Top pages visited:**\n`
    pages.forEach(p => {
      const title = (p.title || p.url).replace(/\n/g, " ").slice(0, 140)
      md += `- [${title}](${p.url})\n`
    })
  } else if (topUrls.length) {
    md += `\n**Top pages visited:**\n`
    topUrls.forEach((u) => md += `- ${u}\n`)
  }
  md += `\n`

  // Focus recap (descriptive)
  if (analysis?.alignment || mostActive?.label || topWorkspace?.label) {
    md += `## Focus Recap\n\n`
    if (mostActive?.label || topWorkspace?.label) {
      const label = mostActive?.label || topWorkspace?.label
      const timeSec = mostActive?.timeSec ?? topWorkspace?.timeSec ?? 0
      md += `You spent the most time in **${label}** (${formatTime(timeSec)}). `
    }
    if (analysis?.alignment) {
      const a = analysis.alignment
      const total =
        (a.alignedSec || 0) +
        (a.offIntentSec || 0) +
        (a.neutralSec || 0) +
        (a.unknownSec || 0)
      const alignedPct = total > 0 ? Math.round((a.alignedSec / total) * 100) : 0
      const offPct = total > 0 ? Math.round((a.offIntentSec / total) * 100) : 0
      md += `Intent alignment was **${alignedPct}% aligned** and **${offPct}% off‑intent**.`
    }
    md += `\n\n`
  }

  // Time breakdown (clean)
  if (workspaces.length) {
    md += `## Time Breakdown\n\n`
    workspaces.slice(0, 8).forEach(ws => {
      md += `- **${ws.label}**: ${formatTime(ws.timeSec)}\n`
    })
    md += `\n`
  }

  // Alignment (if available)
  if (analysis?.alignment) {
    const a = analysis.alignment
    md += `## Intent Alignment (heuristic)\n\n`
    md += `- Aligned: **${formatTime(a.alignedSec)}**\n`
    md += `- Off-intent: **${formatTime(a.offIntentSec)}**\n`
    md += `- Neutral: **${formatTime(a.neutralSec)}**\n`
    md += `- Unknown: **${formatTime(a.unknownSec)}**\n\n`
  }

  // AI guess clearly labeled + confidence
  const groundedRecap = analysis?.aiRecap || analysis?.resumeSummary
  if (groundedRecap) {
    md += `## AI Summary (grounded)\n\n`
    md += `**Confidence:** ${confidence.toString().toUpperCase()}\n\n`
    md += `Note: AI summary is based on URLs/titles only (no content).\n\n`
    md += `${groundedRecap}\n\n`
    if (analysis?.aiActions?.length) {
      md += `**Grounded action items:**\n`
      analysis.aiActions.slice(0, 3).forEach((action) => {
        md += `- ${action}\n`
      })
      md += `\n`
    }
  }

  // Action Plan (make it executable)
  md += `## Action Plan (next 10 minutes)\n\n`
  const actions = (analysis?.nextActions || []).filter(Boolean)

  if (actions.length) {
    actions.slice(0, 3).forEach((action, i) => {
      md += `### ${i + 1}) ${action}\n\n`
      // Attach 1-2 relevant links from the most active workspace
      const links = topWorkspace?.topUrls?.slice(0, 2) || []
      if (links.length) {
        md += `**Quick links:**\n`
        links.forEach(l => md += `- ${l}\n`)
        md += `\n`
      }
      md += `**Micro-step (10 min):** Do the smallest next step that moves this forward.\n\n`
    })
  } else {
    // Honest fallback
    md += `No reliable next actions were inferred (not enough signal).\n\n`
    if (lastStop?.url) {
      md += `**Do this now:** reopen your last stop -> [${lastStop.label}](${lastStop.url})\n\n`
    }
  }

  // Pending decisions (keep, but don't overdo)
  const decisions = (analysis?.pendingDecisions || []).filter(Boolean)
  if (decisions.length) {
    md += `## Pending Decisions\n\n`
    decisions.slice(0, 3).forEach(d => md += `- ${d}\n`)
    md += `\n`
  }

  return md
}

function formatTime(timeSec: number) {
  const m = Math.floor(timeSec / 60)
  const s = timeSec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function inferConfidence(analysis?: any): "high" | "medium" | "low" {
  const a = analysis?.alignment
  if (!a) return "medium"
  const total = (a.alignedSec || 0) + (a.offIntentSec || 0) + (a.neutralSec || 0) + (a.unknownSec || 0)
  if (!total) return "low"
  const unknownPct = (a.unknownSec || 0) / total
  if (unknownPct > 0.5) return "low"
  if (unknownPct > 0.25) return "medium"
  return "high"
}

/**
 * Import markdown to Opennote journal
 */
export async function importJournalToOpennote(
  markdown: string,
  title: string
): Promise<{ journalId: string; url?: string }> {
  const apiKey = process.env.OPENNOTE_API_KEY
  const apiUrl = process.env.OPENNOTE_API_URL || 'https://api.opennote.com'

  if (!apiKey) {
    throw new Error('OPENNOTE_API_KEY environment variable is not set')
  }

  try {
    const response = await fetch(`${apiUrl}/v1/journals/editor/import_from_markdown`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ markdown, title })
    })

    if (!response.ok) {
      let errorText = ''
      try {
        errorText = await response.text()
      } catch {
        errorText = `HTTP ${response.status} ${response.statusText}`
      }
      
      // Check if response is HTML (error page)
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        throw new Error(`Opennote API returned HTML error page (${response.status}). Check API URL: ${apiUrl}`)
      }
      
      throw new Error(`Opennote API error: ${response.status} ${errorText.substring(0, 200)}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const text = await response.text()
      throw new Error(`Expected JSON response, got ${contentType}: ${text.substring(0, 200)}`)
    }

    const data = await response.json()
    return { 
      journalId: data.journal_id || data.id || '', 
      url: data.journal_url || data.url 
    }
  } catch (error: any) {
    // Re-throw with more context if it's a fetch/network error
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`Failed to connect to Opennote API at ${apiUrl}. Check OPENNOTE_API_URL environment variable.`)
    }
    throw error
  }
}