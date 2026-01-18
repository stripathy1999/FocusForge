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
    workspaces?: Array<{ label: string; timeSec: number; topUrls: string[] }>
    lastStop?: { label: string; url: string }
    nextActions?: string[]
    pendingDecisions?: string[]
    goalInferred?: string
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

  let markdown = `# FocusForge — Session Recap (${dateStr})\n\n`

  // Goal / Intent
  if (session.intent_text) {
    markdown += `## Goal / Intent\n\n${session.intent_text}\n\n`
  } else if (analysis?.goalInferred) {
    markdown += `## Goal / Intent\n\n${analysis.goalInferred}\n\n`
  }

  // Where you left off
  if (analysis?.lastStop?.url) {
    markdown += `## Where You Left Off\n\n`
    markdown += `**${analysis.lastStop.label}**\n\n`
    markdown += `${analysis.lastStop.url}\n\n`
  } else if (events.length > 0) {
    const lastEvent = events[events.length - 1]
    markdown += `## Where You Left Off\n\n`
    markdown += `**${lastEvent.title || 'Last visited page'}**\n\n`
    markdown += `${lastEvent.url}\n\n`
  }

  // What you did (top pages grouped by workspace)
  if (analysis?.workspaces && analysis.workspaces.length > 0) {
    markdown += `## What You Did\n\n`
    analysis.workspaces.slice(0, 3).forEach(workspace => {
      markdown += `### ${workspace.label}\n\n`
      if (workspace.topUrls.length > 0) {
        workspace.topUrls.slice(0, 5).forEach(url => {
          markdown += `- ${url}\n`
        })
        markdown += `\n`
      }
    })
  }

  // Time breakdown
  if (analysis?.workspaces && analysis.workspaces.length > 0) {
    markdown += `## Time Breakdown\n\n`
    analysis.workspaces.forEach(workspace => {
      const minutes = Math.floor(workspace.timeSec / 60)
      const seconds = workspace.timeSec % 60
      const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
      markdown += `- **${workspace.label}**: ${timeStr}\n`
    })
    markdown += `\n`
  }

  // AI summary
  if (analysis?.resumeSummary) {
    markdown += `## AI Summary\n\n${analysis.resumeSummary}\n\n`
  }

  // Next actions
  if (analysis?.nextActions && analysis.nextActions.length > 0) {
    markdown += `## Next Actions\n\n`
    analysis.nextActions.slice(0, 5).forEach(action => {
      markdown += `- ${action}\n`
    })
    markdown += `\n`
  }

  // Pending decisions
  if (analysis?.pendingDecisions && analysis.pendingDecisions.length > 0) {
    markdown += `## Pending Decisions\n\n`
    analysis.pendingDecisions.slice(0, 3).forEach(decision => {
      markdown += `- ${decision}\n`
    })
    markdown += `\n`
  }

  return markdown
}

/**
 * Generate practice set description from session data
 */
export function generatePracticeSetDescription(data: SessionData): string {
  const { session, events, analysis } = data
  
  let description = `Focus session from ${new Date(session.started_at).toLocaleDateString()}.\n\n`
  
  if (session.intent_text) {
    description += `Intent: ${session.intent_text}\n\n`
  } else if (analysis?.goalInferred) {
    description += `Goal: ${analysis.goalInferred}\n\n`
  }

  // Extract domains/topics
  const domains = new Set<string>()
  events.forEach(event => {
    if (event.domain) {
      domains.add(event.domain)
    }
  })
  
  if (domains.size > 0) {
    description += `Domains: ${Array.from(domains).slice(0, 5).join(', ')}\n\n`
  }

  // Extract topics from URLs (e.g., LeetCode problems)
  const topics: string[] = []
  events.forEach(event => {
    const url = event.url
    // LeetCode pattern
    const leetcodeMatch = url.match(/leetcode\.com\/problems\/([^/]+)/i)
    if (leetcodeMatch) {
      const problemSlug = leetcodeMatch[1].replace(/-/g, ' ')
      topics.push(`LeetCode: ${problemSlug}`)
    }
    // Docs pattern
    if (url.includes('docs.google.com') || url.includes('documentation')) {
      topics.push('Documentation reading')
    }
  })

  if (topics.length > 0) {
    description += `Topics: ${Array.from(new Set(topics)).slice(0, 5).join(', ')}\n\n`
  }

  description += `User level: Interview prep / Mid-level\n`

  return description
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

  const response = await fetch(`${apiUrl}/v1/journals/editor/import_from_markdown`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ markdown, title })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Opennote API error: ${response.status} ${errorText}`)
  }

  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text()
    throw new Error(`Expected JSON response, got ${contentType}: ${text.substring(0, 200)}`)
  }

  const data = await response.json()
  return { 
    journalId: data.journal_id || data.id || '', 
    url: data.journal_url || data.url 
  }
}

/**
 * Create practice set in Opennote
 */
export async function createPracticeSet(
  setDescription: string,
  numProblems: number = 5,
  webhookUrl?: string,
  setName?: string
): Promise<{ setId: string }> {
  const apiKey = process.env.OPENNOTE_API_KEY
  const apiUrl = process.env.OPENNOTE_API_URL || 'https://api.opennote.com'

  if (!apiKey) {
    throw new Error('OPENNOTE_API_KEY environment variable is not set')
  }

  const body: any = {
    set_description: setDescription,
    num_problems: numProblems
  }

  if (webhookUrl) {
    body.webhook_url = webhookUrl
  }

  if (setName) {
    body.set_name = setName
  }

  const response = await fetch(`${apiUrl}/v1/interactives/practice/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Opennote Practice API error: ${response.status} ${errorText}`)
  }

  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text()
    throw new Error(`Expected JSON response, got ${contentType}: ${text.substring(0, 200)}`)
  }

  const data = await response.json()
  return { setId: data.set_id || data.id || '' }
}