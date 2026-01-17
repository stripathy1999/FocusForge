import { supabaseAdmin } from './supabase'

const IDLE_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Check and auto-pause idle sessions
 * Called periodically or on event insertion
 */
export async function checkAndAutoPauseIdleSessions(): Promise<void> {
  try {
    const now = Date.now()
    const threshold = now - IDLE_THRESHOLD_MS

    // Get all active sessions
    const { data: activeSessions, error: sessionsError } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('status', 'active')

    if (sessionsError || !activeSessions || activeSessions.length === 0) {
      return
    }

    // For each active session, check last event timestamp
    for (const session of activeSessions) {
      const { data: lastEvent, error: eventError } = await supabaseAdmin
        .from('events')
        .select('ts')
        .eq('session_id', session.id)
        .order('ts', { ascending: false })
        .limit(1)
        .single()

      if (eventError) {
        // No events yet - check if session is old enough
        const { data: sessionData } = await supabaseAdmin
          .from('sessions')
          .select('started_at')
          .eq('id', session.id)
          .single()

        if (sessionData) {
          const startedAt = new Date(sessionData.started_at).getTime()
          if (startedAt < threshold) {
            // Session started more than 30 min ago with no events - pause it
            await supabaseAdmin
              .from('sessions')
              .update({ status: 'paused' })
              .eq('id', session.id)
          }
        }
      } else if (lastEvent && lastEvent.ts < threshold) {
        // Last event was more than 30 min ago - pause session
        await supabaseAdmin
          .from('sessions')
          .update({ status: 'paused' })
          .eq('id', session.id)
      }
    }
  } catch (error) {
    // Silently fail - don't break the app
    console.error('Error in auto-pause check:', error)
  }
}
