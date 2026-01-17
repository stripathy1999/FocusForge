import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID' })
    }

    // Get session metadata
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    // Get ordered events
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('session_id', id)
      .order('ts', { ascending: true })

    if (eventsError) {
      console.error('Error fetching events:', eventsError)
      return res.status(500).json({ error: eventsError.message })
    }

    // Get analysis if available
    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('analysis')
      .select('summary_json')
      .eq('session_id', id)
      .single()

    // Analysis error is OK (might not exist yet)
    if (analysisError && analysisError.code !== 'PGRST116') {
      console.error('Error fetching analysis:', analysisError)
    }

    return res.status(200).json({
      session: {
        id: session.id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        status: session.status
      },
      events: events || [],
      analysis: analysis?.summary_json || null
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
