import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { generateSessionMarkdown, importJournalToOpennote } from '@/lib/opennote'
import { getSafeDefaultAnalysis } from '@/lib/utils'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sessionId } = req.body

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Invalid sessionId' })
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

    // Fetch analysis (optional - use heuristic fallback if missing)
    const { data: analysis } = await supabaseAdmin
      .from('analysis')
      .select('summary_json')
      .eq('session_id', sessionId)
      .single()

    // Use analysis if available, otherwise use safe defaults
    const analysisData = analysis?.summary_json || getSafeDefaultAnalysis()

    // Generate markdown
    const sessionData = {
      session: {
        id: session.id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        intent_text: session.intent_text
      },
      events: events || [],
      analysis: analysisData
    }

    const markdown = generateSessionMarkdown(sessionData)
    const title = `FocusForge — Session ${sessionId.slice(0, 8)}`

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

    // Store export record (optional - log but don't fail)
    try {
      await supabaseAdmin
        .from('opennote_exports')
        .insert({
          session_id: sessionId,
          journal_id: journalResult.journalId,
          journal_url: journalResult.url || null
        })
    } catch (err) {
      // Log but don't fail - export succeeded
      console.error('Error storing export record:', err)
    }

    return res.status(200).json({
      ok: true,
      journalId: journalResult.journalId,
      journalUrl: journalResult.url
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    })
  }
}