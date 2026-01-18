import { NextRequest, NextResponse } from 'next/server'
import { getSession, getEvents, getAnalysis } from '@/lib/store'
import { computeSummary } from '@/lib/grouping'
import { generateSessionMarkdown, importJournalToOpennote } from '@/lib/opennote'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    // Get session data from local store
    const session = await getSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const events = await getEvents(sessionId)
    const analysis = await getAnalysis(sessionId)
    const computedSummary = computeSummary(session, events, analysis)

    // Convert timeline events to Opennote format
    const timelineEvents = computedSummary.timeline.filter(e => e.type === 'TAB_ACTIVE')
    
    const sessionData = {
      session: {
        id: session.id,
        started_at: new Date(session.started_at).toISOString(),
        ended_at: session.ended_at ? new Date(session.ended_at).toISOString() : null,
        intent_text: session.intent_raw || null
      },
      events: timelineEvents.map(e => ({
        url: e.url,
        title: e.title || null,
        duration_sec: e.durationSec || null,
        domain: e.domain || null,
        ts: new Date(e.ts).toISOString()
      })),
      analysis: {
        resumeSummary: computedSummary.resumeSummary || '',
        workspaces: computedSummary.domains.map(d => ({
          label: d.label,
          timeSec: d.timeSec,
          topUrls: d.topUrls
        })),
        lastStop: computedSummary.lastStop ? {
          label: computedSummary.lastStop.label || computedSummary.lastStop.title || '',
          url: computedSummary.lastStop.url
        } : { label: '', url: '' },
        nextActions: computedSummary.nextActions || [],
        pendingDecisions: computedSummary.pendingDecisions || [],
        goalInferred: ''
      }
    }

    // Generate markdown
    const markdown = generateSessionMarkdown(sessionData)
    const title = `FocusForge — Session ${sessionId.slice(0, 8)}`

    // Export to Opennote
    let journalResult
    try {
      journalResult = await importJournalToOpennote(markdown, title)
    } catch (opennoteError: any) {
      console.error('Opennote export error:', opennoteError)
      return NextResponse.json({ 
        error: 'Failed to export to Opennote',
        details: opennoteError.message 
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      journalId: journalResult.journalId,
      journalUrl: journalResult.url
    })
  } catch (error: any) {
    console.error('Journal export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export journal' },
      { status: 500 }
    )
  }
}