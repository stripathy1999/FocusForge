import { supabaseAdmin } from './supabase'
import { IDLE_BREAK_MS, IDLE_END_MS } from './idle-policy'

/**
 * Check and auto-pause/end idle sessions
 * Called periodically or on event insertion
 */
export async function checkAndAutoPauseIdleSessions(): Promise<void> {
  try {
    const now = Date.now()
    const breakThreshold = now - IDLE_BREAK_MS
    const endThreshold = now - IDLE_END_MS

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
          if (startedAt < endThreshold) {
            await supabaseAdmin
              .from('sessions')
              .update({ status: 'ended', ended_at: new Date(startedAt).toISOString() })
              .eq('id', session.id)
            console.info('[IdlePolicy] Auto-ended session (no events)', {
              sessionId: session.id,
              startedAt,
            })
            continue
          }
          if (startedAt < breakThreshold) {
            await supabaseAdmin
              .from('sessions')
              .update({ status: 'paused' })
              .eq('id', session.id)
            await supabaseAdmin.from('events').insert({
              session_id: session.id,
              ts: startedAt,
              type: 'BREAK',
              url: '',
              title: 'Break',
              duration_sec: null,
              domain: null,
            })
            console.info('[IdlePolicy] Auto-paused session (no events)', {
              sessionId: session.id,
              startedAt,
            })
          }
        }
      } else if (lastEvent && lastEvent.ts < endThreshold) {
        // Last event was beyond end threshold - end session
        await supabaseAdmin
          .from('sessions')
          .update({ status: 'ended', ended_at: new Date(lastEvent.ts).toISOString() })
          .eq('id', session.id)
        await supabaseAdmin.from('events').insert({
          session_id: session.id,
          ts: lastEvent.ts,
          type: 'STOP',
          url: '',
          title: 'Auto-ended due to inactivity',
          duration_sec: null,
          domain: null,
        })
        console.info('[IdlePolicy] Auto-ended session', {
          sessionId: session.id,
          lastEventTs: lastEvent.ts,
        })
      } else if (lastEvent && lastEvent.ts < breakThreshold) {
        // Last event was beyond break threshold - pause session
        await supabaseAdmin
          .from('sessions')
          .update({ status: 'paused' })
          .eq('id', session.id)
        await supabaseAdmin.from('events').insert({
          session_id: session.id,
          ts: lastEvent.ts,
          type: 'BREAK',
          url: '',
          title: 'Break',
          duration_sec: null,
          domain: null,
        })
        console.info('[IdlePolicy] Auto-paused session', {
          sessionId: session.id,
          lastEventTs: lastEvent.ts,
        })
      }
    }
  } catch (error) {
    // Silently fail - don't break the app
    console.error('Error in auto-pause check:', error)
  }
}
