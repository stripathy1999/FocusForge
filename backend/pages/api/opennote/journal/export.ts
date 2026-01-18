import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { generateSessionMarkdown, importJournalToOpennote } from '@/lib/opennote'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sessionId } = req.body

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' })
    }

    // Fetch session data
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    // Fetch events
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true })

    if (eventsError) {
      console.error('Error fetching events:', eventsError)
      return res.status(500).json({ error: eventsError.message })
    }

    // Fetch analysis (optional - will use fallback if not available)
    const { data: analysis } = await supabaseAdmin
      .from('analysis')
      .select('summary_json')
      .eq('session_id', sessionId)
      .single()

    // Prepare session data
    const sessionData = {
      session: {
        id: session.id,
        status: session.status,
        started_at: session.started_at,
        ended_at: session.ended_at,
        intent_text: session.intent_text,
        created_at: session.created_at
      },
      events: events || [],
      analysis: analysis?.summary_json || null
    }

    // Generate markdown (always works - has fallback)
    const markdown = generateSessionMarkdown(sessionData)

    // Generate title
    const startDate = new Date(session.started_at)
    const dateStr = startDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit' 
    })
    const title = `FocusForge — Session Recap (${dateStr})`

    // Export to Opennote
    let journalResult
    try {
      journalResult = await importJournalToOpennote(markdown, title)
    } catch (opennoteError: any) {
      console.error('Opennote export error:', opennoteError)
      return res.status(500).json({ 
        error: 'Failed to export to Opennote',
        details: opennoteError.message 
      })
    }

    // Store export record
    await supabaseAdmin
      .from('opennote_exports')
      .insert({
        session_id: sessionId,
        journal_id: journalResult.journalId,
        journal_url: journalResult.url || null
      })
      .catch((err) => {
        // Log but don't fail - export succeeded
        console.error('Error storing export record:', err)
      })

    return res.status(200).json({
      ok: true,
      journalId: journalResult.journalId,
      journalUrl: journalResult.url,
      message: 'Journal exported successfully'
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    })
  }
}
