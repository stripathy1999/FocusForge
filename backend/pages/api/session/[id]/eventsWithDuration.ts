import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { EventWithDuration } from '@/lib/db.types'

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

    // Calculate durationSec for each event
    const eventsWithDuration: EventWithDuration[] = events.map((event, index) => {
      const nextEvent = events[index + 1]
      
      // For last event, use default duration (30-60s)
      const durationSec = nextEvent 
        ? Math.floor((nextEvent.ts - event.ts) / 1000)
        : 30 // Default 30s for last event
      
      return {
        ...event,
        durationSec: Math.max(1, durationSec) // Ensure at least 1 second
      }
    })

    return res.status(200).json({ events: eventsWithDuration })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
