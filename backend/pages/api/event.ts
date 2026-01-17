import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { extractDomain } from '@/lib/utils'
import { checkAndAutoPauseIdleSessions } from '@/lib/auto-pause'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sessionId, ts, url, title } = req.body

    // Validate required fields
    if (!sessionId || ts === undefined || !url) {
      return res.status(200).json({ success: true, message: 'Missing required fields (tolerated)' })
    }

    // Validate types
    if (typeof ts !== 'number' || ts <= 0) {
      return res.status(200).json({ success: true, message: 'Invalid ts (tolerated)' })
    }

    if (typeof url !== 'string' || url.trim() === '') {
      return res.status(200).json({ success: true, message: 'Invalid url (tolerated)' })
    }

    // Get previous event to calculate duration
    const { data: previousEvents } = await supabaseAdmin
      .from('events')
      .select('ts')
      .eq('session_id', sessionId)
      .order('ts', { ascending: false })
      .limit(1)
      .single()

    // Calculate duration_sec
    let duration_sec: number | null = null
    if (previousEvents && previousEvents.ts) {
      duration_sec = Math.max(1, Math.floor((ts - previousEvents.ts) / 1000))
    }

    // Extract domain
    const domain = extractDomain(url.trim())

    // Insert event (ignore duplicates - let DB handle it)
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        session_id: sessionId,
        ts: ts,
        url: url.trim(),
        title: (title || '').trim() || null,
        duration_sec: duration_sec,
        domain: domain
      })
      .select()
      .single()

    // If error is due to duplicate or constraint violation, return success (tolerant)
    if (error) {
      // Check if it's a duplicate/constraint error (PostgreSQL error codes)
      if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
        // Duplicate event - return success (tolerant behavior)
        return res.status(200).json({ success: true, message: 'Event already exists' })
      }
      
      // For other errors, still return success (tolerant)
      console.error('Error inserting event (tolerated):', error)
      return res.status(200).json({ success: true, message: 'Event processed (may have been ignored)' })
    }

    // Update session status to active if it was paused (resume on new event)
    await supabaseAdmin
      .from('sessions')
      .update({ status: 'active' })
      .eq('id', sessionId)
      .eq('status', 'paused')

    // Check for idle sessions (non-blocking)
    checkAndAutoPauseIdleSessions().catch(() => {
      // Ignore errors in background task
    })

    return res.status(200).json({ success: true, id: data.id })
  } catch (error: any) {
    // Catch any malformed data or unexpected errors - return success (tolerant)
    console.error('Unexpected error (tolerated):', error)
    return res.status(200).json({ success: true, message: 'Event processed (may have been ignored)' })
  }
}
