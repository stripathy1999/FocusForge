export interface Session {
  id: string
  started_at: string
  ended_at: string | null
  status: 'running' | 'ended' | 'analyzed'
}

export interface Event {
  id: string
  session_id: string
  ts: number
  url: string
  title: string
}

export interface Analysis {
  session_id: string
  summary_json: any
}

export interface EventWithDuration extends Event {
  durationSec: number
}
