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
    const { sessionId, ts, url, title } = req.body

    // Validate required fields
    if (!sessionId || ts === undefined || !url) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, ts, url' })
    }

    // Validate types
    if (typeof ts !== 'number' || ts <= 0) {
      return res.status(400).json({ error: 'ts must be a positive number (epoch ms)' })
    }

    if (typeof url !== 'string' || url.trim() === '') {
      return res.status(400).json({ error: 'url must be a non-empty string' })
    }

    // Insert event (ignore duplicates - let DB handle it)
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        session_id: sessionId,
        ts: ts,
        url: url.trim(),
        title: (title || '').trim()
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
      
      console.error('Error inserting event:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, id: data.id })
  } catch (error: any) {
    // Catch any malformed data or unexpected errors - return success (tolerant)
    console.error('Unexpected error (tolerated):', error)
    return res.status(200).json({ success: true, message: 'Event processed (may have been ignored)' })
  }
}
