/**
 * Opennote API Integration
 * Handles journal export and practice set generation
 */

interface SessionData {
  session: {
    id: string
    status: string
    started_at: string
    ended_at: string | null
    intent_text: string | null
    created_at: string
  }
  events: Array<{
    id: string
    url: string
    title: string | null
    duration_sec: number | null
    domain: string | null
    ts: number
  }>
  analysis: {
    goalInferred?: string
    workspaces?: Array<{
      label: string
      timeSec: number
      topUrls: string[]
    }>
    resumeSummary?: string
    lastStop?: {
      label: string
      url: string
    }
    nextActions?: string[]
    pendingDecisions?: string[]
  } | null
}

/**
 * Generate markdown from session data
 * Uses AI analysis if available, falls back to heuristic
 */
export function generateSessionMarkdown(data: SessionData): string {
  const { session, events, analysis } = data
  
  // Format date
  const startDate = new Date(session.started_at)
  const dateStr = startDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit' 
  })

  // Title
  let markdown = `# FocusForge — Session Recap (${dateStr})\n\n`

  // Goal / Intent
  markdown += `## Goal / Intent\n\n`
  const intent = session.intent_text || analysis?.goalInferred || "No specific goal recorded."
  markdown += `${intent}\n\n`

  // Where you left off
  markdown += `## Where You Left Off\n\n`
  if (analysis?.lastStop?.url) {
    markdown += `**${analysis.lastStop.label}**\n\n`
    markdown += `[${analysis.lastStop.url}](${analysis.lastStop.url})\n\n`
  } else if (events.length > 0) {
    const lastEvent = events[events.length - 1]
    markdown += `**${lastEvent.title || 'Last page'}**\n\n`
    markdown += `[${lastEvent.url}](${lastEvent.url})\n\n`
  } else {
    markdown += `No activity recorded.\n\n`
  }

  // What you did (top pages grouped by workspace)
  markdown += `## What You Did\n\n`
  if (analysis?.workspaces && analysis.workspaces.length > 0) {
    // Use AI analysis workspaces
    const topWorkspaces = analysis.workspaces
      .sort((a, b) => b.timeSec - a.timeSec)
      .slice(0, 3)
    
    for (const workspace of topWorkspaces) {
      markdown += `### ${workspace.label}\n\n`
      const topUrls = workspace.topUrls.slice(0, 5)
      for (const url of topUrls) {
        const event = events.find(e => e.url === url)
        const title = event?.title || url
        markdown += `- [${title}](${url})\n`
      }
      markdown += `\n`
    }
  } else {
    // Fallback: group by domain
    const domainGroups = new Map<string, Array<{ url: string; title: string | null }>>()
    for (const event of events) {
      const domain = event.domain || 'unknown'
      if (!domainGroups.has(domain)) {
        domainGroups.set(domain, [])
      }
      domainGroups.get(domain)!.push({ url: event.url, title: event.title })
    }
    
    const sortedDomains = Array.from(domainGroups.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
    
    for (const [domain, urls] of sortedDomains) {
      markdown += `### ${domain}\n\n`
      for (const { url, title } of urls.slice(0, 5)) {
        markdown += `- [${title || url}](${url})\n`
      }
      markdown += `\n`
    }
  }

  // Time breakdown
  markdown += `## Time Breakdown\n\n`
  if (analysis?.workspaces && analysis.workspaces.length > 0) {
    const totalTime = analysis.workspaces.reduce((sum, w) => sum + w.timeSec, 0)
    for (const workspace of analysis.workspaces.slice(0, 5)) {
      const minutes = Math.floor(workspace.timeSec / 60)
      const seconds = workspace.timeSec % 60
      const percentage = totalTime > 0 ? Math.round((workspace.timeSec / totalTime) * 100) : 0
      markdown += `- **${workspace.label}**: ${minutes}m ${seconds}s (${percentage}%)\n`
    }
  } else {
    // Fallback: calculate from events
    const totalDuration = events.reduce((sum, e) => sum + (e.duration_sec || 0), 0)
    const domainTime = new Map<string, number>()
    for (const event of events) {
      const domain = event.domain || 'unknown'
      domainTime.set(domain, (domainTime.get(domain) || 0) + (event.duration_sec || 0))
    }
    const sortedDomains = Array.from(domainTime.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    for (const [domain, timeSec] of sortedDomains) {
      const minutes = Math.floor(timeSec / 60)
      const seconds = timeSec % 60
      const percentage = totalDuration > 0 ? Math.round((timeSec / totalDuration) * 100) : 0
      markdown += `- **${domain}**: ${minutes}m ${seconds}s (${percentage}%)\n`
    }
  }
  markdown += `\n`

  // AI Summary
  if (analysis?.resumeSummary) {
    markdown += `## AI Summary\n\n`
    markdown += `${analysis.resumeSummary}\n\n`
  }

  // Next Actions
  if (analysis?.nextActions && analysis.nextActions.length > 0) {
    markdown += `## Next Actions\n\n`
    for (const action of analysis.nextActions.slice(0, 5)) {
      markdown += `- ${action}\n`
    }
    markdown += `\n`
  }

  // Pending Decisions
  if (analysis?.pendingDecisions && analysis.pendingDecisions.length > 0) {
    markdown += `## Pending Decisions\n\n`
    for (const decision of analysis.pendingDecisions.slice(0, 3)) {
      markdown += `- ${decision}\n`
    }
    markdown += `\n`
  }

  return markdown
}

/**
 * Generate practice set description from session data
 */
export function generatePracticeSetDescription(data: SessionData): string {
  const { session, events, analysis } = data
  
  const intent = session.intent_text || analysis?.goalInferred || "general learning"
  
  // Extract domains
  const domains = new Set<string>()
  for (const event of events) {
    if (event.domain) {
      domains.add(event.domain)
    }
  }
  const domainList = Array.from(domains).join(", ")
  
  // Extract topics from URLs (e.g., leetcode problem slugs)
  const topics: string[] = []
  for (const event of events) {
    const url = event.url.toLowerCase()
    if (url.includes('leetcode.com/problems/')) {
      const match = url.match(/problems\/([^\/]+)/)
      if (match) {
        const slug = match[1].replace(/-/g, ' ')
        topics.push(slug)
      }
    } else if (url.includes('docs.') || url.includes('documentation')) {
      topics.push('documentation review')
    }
  }
  const topicList = topics.length > 0 ? topics.slice(0, 3).join(", ") : "general concepts"
  
  // Build description
  let description = `Focus session intent: ${intent}\n\n`
  description += `Domains visited: ${domainList || "various"}\n\n`
  description += `Topics covered: ${topicList}\n\n`
  description += `User level: interview prep / mid-level\n\n`
  description += `Generate practice problems related to the topics and concepts explored in this session.`
  
  return description
}

/**
 * Call Opennote Journals API to import markdown
 */
export async function importJournalToOpennote(
  markdown: string,
  title: string
): Promise<{ journalId: string; url?: string }> {
  const apiKey = process.env.OPENNOTE_API_KEY
  if (!apiKey) {
    throw new Error('OPENNOTE_API_KEY environment variable not set')
  }

  const apiUrl = process.env.OPENNOTE_API_URL || 'https://api.opennote.com'
  
  const response = await fetch(`${apiUrl}/v1/journals/editor/import_from_markdown`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      markdown,
      title
    })
  })

  if (!response.ok) {
    let errorText: string
    const contentType = response.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      try {
        const errorData = await response.json()
        errorText = JSON.stringify(errorData)
      } catch {
        errorText = await response.text()
      }
    } else {
      errorText = await response.text()
    }
    
    throw new Error(`Opennote API error: ${response.status} - ${errorText}`)
  }

  let data: any
  const contentType = response.headers.get('content-type')
  
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json()
    } catch (parseError: any) {
      const text = await response.text()
      throw new Error(`Failed to parse JSON response: ${parseError.message}. Response: ${text.substring(0, 200)}`)
    }
  } else {
    const text = await response.text()
    throw new Error(`Expected JSON but got ${contentType || 'text/plain'}. Response: ${text.substring(0, 200)}`)
  }
  
  return {
    journalId: data.journal_id || data.id,
    url: data.journal_url || data.url
  }
}

/**
 * Call Opennote Practice API to create practice set
 * Endpoint: POST /v1/interactives/practice/create
 * Docs: https://docs.opennote.com/home/offerings/practice
 */
export async function createPracticeSet(
  setDescription: string,
  numProblems: number = 5,
  webhookUrl?: string,
  setName?: string
): Promise<{ setId: string; status?: string }> {
  const apiKey = process.env.OPENNOTE_API_KEY
  if (!apiKey) {
    throw new Error('OPENNOTE_API_KEY environment variable not set')
  }

  const apiUrl = process.env.OPENNOTE_API_URL || 'https://api.opennote.com'
  
  // Validate num_problems (must be 1-15)
  const validatedNumProblems = Math.max(1, Math.min(15, numProblems))
  
  const body: any = {
    set_description: setDescription,
    num_problems: validatedNumProblems
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
    let errorText: string
    const contentType = response.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      try {
        const errorData = await response.json()
        errorText = JSON.stringify(errorData)
      } catch {
        errorText = await response.text()
      }
    } else {
      errorText = await response.text()
    }
    
    throw new Error(`Opennote Practice API error: ${response.status} - ${errorText}`)
  }

  let data: any
  const contentType = response.headers.get('content-type')
  
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json()
    } catch (parseError: any) {
      const text = await response.text()
      throw new Error(`Failed to parse JSON response: ${parseError.message}. Response: ${text.substring(0, 200)}`)
    }
  } else {
    const text = await response.text()
    throw new Error(`Expected JSON but got ${contentType || 'text/plain'}. Response: ${text.substring(0, 200)}`)
  }
  
  return {
    setId: data.set_id || data.id || data.practice_set_id,
    status: data.status
  }
}
