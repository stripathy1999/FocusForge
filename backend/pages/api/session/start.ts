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
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        started_at: new Date().toISOString(),
        status: 'running'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ sessionId: data.id })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
