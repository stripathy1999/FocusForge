import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

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

    // Mark session as ended
    const { error: updateError } = await supabaseAdmin
      .from('sessions')
      .update({
        ended_at: new Date().toISOString(),
        status: 'ended'
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Error updating session:', updateError)
      return res.status(500).json({ error: updateError.message })
    }

    // Trigger analysis job
    try {
      // Get events for this session
      const { data: events, error: eventsError } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true })

      if (eventsError) {
        throw new Error(`Failed to fetch events: ${eventsError.message}`)
      }

      if (!events || events.length === 0) {
        // No events - store empty analysis
        await supabaseAdmin
          .from('analysis')
          .upsert({
            session_id: sessionId,
            summary_json: {
              goalInferred: "No activity detected",
              workspaces: [],
              resumeSummary: "No browser activity was recorded in this session.",
              lastStop: { label: "Unknown", url: "" },
              nextActions: [],
              pendingDecisions: []
            }
          })

        await supabaseAdmin
          .from('sessions')
          .update({ status: 'analyzed' })
          .eq('id', sessionId)

        return res.status(200).json({ success: true, message: 'Session ended (no events)' })
      }

      // Calculate durations for events
      const eventsWithDuration = events.map((event, index) => {
        const nextEvent = events[index + 1]
        const durationSec = nextEvent 
          ? Math.floor((nextEvent.ts - event.ts) / 1000)
          : 30 // Default 30s for last event
        
        return {
          ts: event.ts,
          url: event.url,
          title: event.title,
          durationSec: Math.max(1, durationSec) // Ensure at least 1 second
        }
      })

      // Call analysis API (internal)
      const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal: '',
          events: eventsWithDuration
        })
      })

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text()
        throw new Error(`Analysis failed: ${errorText}`)
      }

      const summaryJson = await analysisResponse.json()

      // Store analysis result
      const { error: analysisError } = await supabaseAdmin
        .from('analysis')
        .upsert({
          session_id: sessionId,
          summary_json: summaryJson
        })

      if (analysisError) {
        throw new Error(`Failed to store analysis: ${analysisError.message}`)
      }

      // Update session status to analyzed
      await supabaseAdmin
        .from('sessions')
        .update({ status: 'analyzed' })
        .eq('id', sessionId)

      return res.status(200).json({ success: true, message: 'Session ended and analyzed' })
    } catch (analysisError: any) {
      console.error('Analysis error:', analysisError)
      // Still mark session as ended even if analysis fails
      return res.status(200).json({ 
        success: true, 
        message: 'Session ended (analysis may have failed)',
        error: analysisError.message 
      })
    }
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
