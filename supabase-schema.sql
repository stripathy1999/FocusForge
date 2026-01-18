-- FocusForge Database Schema (root app)
-- Run this in your Supabase SQL Editor

-- Create sessions table
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  goal text,
  raw_context text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'running'
);

-- Create session events table
create table if not exists session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  ts bigint not null,
  type text not null,
  url text,
  title text,
  meta jsonb
);

-- Analysis table for Gemini summaries
create table if not exists analysis (
  session_id uuid primary key references sessions(id) on delete cascade,
  summary_json jsonb not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_sessions_started_at on sessions(started_at desc);
create index if not exists idx_session_events_session_id_ts on session_events(session_id, ts);

-- Disable RLS for hackathon demo
alter table sessions disable row level security;
alter table session_events disable row level security;
alter table analysis disable row level security;
