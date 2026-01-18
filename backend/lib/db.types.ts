export interface Session {
  id: string
  status: 'active' | 'paused' | 'ended'
  started_at: string
  ended_at: string | null
  intent_text: string | null
  created_at: string
}

export interface Event {
  id: string
  session_id: string
  ts: number
  url: string
  title: string | null
  duration_sec: number | null
  domain: string | null
  created_at: string
}

export interface Analysis {
  session_id: string
  summary_json: any
  created_at: string
}
