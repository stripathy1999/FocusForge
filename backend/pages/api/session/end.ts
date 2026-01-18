import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { getSafeDefaultAnalysis, sanitizeAnalysis } from '@/lib/utils'

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

    // Check if analysis already exists (don't re-analyze)
    const { data: existingAnalysis } = await supabaseAdmin
      .from('analysis')
      .select('summary_json')
      .eq('session_id', sessionId)
      .single()

    if (existingAnalysis) {
      // Analysis already exists, just mark as ended
      await supabaseAdmin
        .from('sessions')
        .update({
          ended_at: new Date().toISOString(),
          status: 'ended'
        })
        .eq('id', sessionId)

      return res.status(200).json({ success: true, message: 'Session ended (analysis already exists)' })
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
        // No events - store safe default analysis
        const safeAnalysis = getSafeDefaultAnalysis()
        safeAnalysis.resumeSummary = "No browser activity was recorded in this session."
        
        await supabaseAdmin
          .from('analysis')
          .upsert({
            session_id: sessionId,
            summary_json: safeAnalysis
          })

        return res.status(200).json({ success: true, message: 'Session ended (no events)' })
      }

      // Prepare events with duration (use stored duration_sec or calculate)
      const eventsWithDuration = events.map((event, index) => {
        let durationSec = event.duration_sec
        if (!durationSec || durationSec <= 0) {
          const nextEvent = events[index + 1]
          durationSec = nextEvent 
            ? Math.max(1, Math.floor((nextEvent.ts - event.ts) / 1000))
            : 30 // Default 30s for last event
        }
        
        return {
          ts: event.ts,
          url: event.url,
          title: event.title || '',
          durationSec: durationSec
        }
      })

      // Get intent_text from session
      const { data: session } = await supabaseAdmin
        .from('sessions')
        .select('intent_text')
        .eq('id', sessionId)
        .single()

      const goal = session?.intent_text || ''

      // Call analysis API (internal)
      let summaryJson: any
      try {
        const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            goal: goal,
            events: eventsWithDuration
          }),
          // Add timeout
          signal: AbortSignal.timeout(30000) // 30 second timeout
        })

        if (!analysisResponse.ok) {
          throw new Error(`Analysis API returned ${analysisResponse.status}`)
        }

        summaryJson = await analysisResponse.json()
      } catch (analysisError: any) {
        console.error('Analysis API error:', analysisError)
        // Use safe default if analysis fails
        summaryJson = getSafeDefaultAnalysis()
      }

      // Sanitize and validate analysis JSON
      summaryJson = sanitizeAnalysis(summaryJson)

      // Store analysis result
      const { error: analysisError } = await supabaseAdmin
        .from('analysis')
        .upsert({
          session_id: sessionId,
          summary_json: summaryJson
        })

      if (analysisError) {
        console.error('Error storing analysis:', analysisError)
        // Still return success - analysis stored with safe defaults
      }

      return res.status(200).json({ success: true, message: 'Session ended and analyzed' })
    } catch (analysisError: any) {
      console.error('Analysis error:', analysisError)
      // Store safe default analysis
      const safeAnalysis = getSafeDefaultAnalysis()
      await supabaseAdmin
        .from('analysis')
        .upsert({
          session_id: sessionId,
          summary_json: safeAnalysis
        })
        .catch(() => {
          // Ignore errors storing safe default
        })

      return res.status(200).json({ 
        success: true, 
        message: 'Session ended (using safe default analysis)'
      })
    }
  } catch (error: any) {
    console.error('Unexpected error:', error)
    // Always return success with safe defaults
    try {
      const safeAnalysis = getSafeDefaultAnalysis()
      await supabaseAdmin
        .from('analysis')
        .upsert({
          session_id: req.body?.sessionId,
          summary_json: safeAnalysis
        })
    } catch {
      // Ignore
    }
    return res.status(200).json({ 
      success: true, 
      message: 'Session ended (error handled safely)' 
    })
  }
}
