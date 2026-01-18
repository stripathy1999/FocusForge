import { NextRequest, NextResponse } from 'next/server'
import { getSession, getEvents, getAnalysis } from '@/lib/store'
import { computeSummary } from '@/lib/grouping'
import { generatePracticeSetDescription, createPracticeSet } from '@/lib/opennote'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    // Get session data from local store
    const session = getSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const events = getEvents(sessionId)
    const analysis = getAnalysis(sessionId)
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

    // Generate practice set description
    const setDescription = generatePracticeSetDescription(sessionData)

    // Build webhook URL (for async completion)
    const protocol = process.env.VERCEL_URL ? 'https' : 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const webhookUrl = `${protocol}://${host}/api/opennote/practice/webhook`

    // Create practice set
    let practiceResult
    try {
      practiceResult = await createPracticeSet(
        setDescription, 
        5, 
        webhookUrl, 
        `FocusForge Session ${sessionId.slice(0, 8)}`
      )
    } catch (opennoteError: any) {
      console.error('Opennote practice creation error:', opennoteError)
      return NextResponse.json({ 
        error: 'Failed to create practice set',
        details: opennoteError.message 
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      setId: practiceResult.setId,
      message: 'Practice set creation initiated'
    })
  } catch (error: any) {
    console.error('Practice set creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create practice set' },
      { status: 500 }
    )
  }
}