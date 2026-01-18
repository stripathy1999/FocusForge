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

    if (!events || events.length === 0) {
      return res.status(200).json({ events: [] })
    }

    // Use stored duration_sec or calculate if missing
    const eventsWithDuration = events.map((event, index) => {
      let durationSec = event.duration_sec
      
      // If duration_sec is not stored, calculate it
      if (!durationSec || durationSec <= 0) {
        const nextEvent = events[index + 1]
        durationSec = nextEvent 
          ? Math.max(1, Math.floor((nextEvent.ts - event.ts) / 1000))
          : 30 // Default 30s for last event
      }
      
      return {
        ...event,
        durationSec: durationSec
      }
    })

    return res.status(200).json({ events: eventsWithDuration })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
