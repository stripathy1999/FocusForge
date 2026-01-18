import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { generatePracticeSetDescription, createPracticeSet } from '@/lib/opennote'

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

    // Fetch analysis (optional)
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

    // Generate practice set description
    const setDescription = generatePracticeSetDescription(sessionData)

    // Build webhook URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    const webhookUrl = `${appUrl}/api/opennote/practice/webhook`

    // Create practice set
    let practiceResult
    try {
      practiceResult = await createPracticeSet(setDescription, 5, webhookUrl, `FocusForge Session ${sessionId.slice(0, 8)}`)
    } catch (opennoteError: any) {
      console.error('Opennote practice creation error:', opennoteError)
      return res.status(500).json({ 
        error: 'Failed to create practice set',
        details: opennoteError.message 
      })
    }

    // Store practice set record
    await supabaseAdmin
      .from('opennote_exports')
      .upsert({
        session_id: sessionId,
        practice_set_id: practiceResult.setId
      }, {
        onConflict: 'session_id',
        ignoreDuplicates: false
      })
      .catch((err) => {
        // Log but don't fail - practice set creation succeeded
        console.error('Error storing practice set record:', err)
      })

    return res.status(200).json({
      ok: true,
      setId: practiceResult.setId,
      message: 'Practice set creation initiated'
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    })
  }
}
