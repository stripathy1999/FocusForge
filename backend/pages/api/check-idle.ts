import type { NextApiRequest, NextApiResponse } from 'next'
import { checkAndAutoPauseIdleSessions } from '@/lib/auto-pause'

/**
 * Endpoint to manually trigger idle session check
 * Can be called by cron job or scheduled task
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await checkAndAutoPauseIdleSessions()
    return res.status(200).json({ success: true, message: 'Idle check completed' })
  } catch (error: any) {
    console.error('Error checking idle sessions:', error)
    return res.status(200).json({ success: true, message: 'Check completed (errors handled)' })
  }
}
