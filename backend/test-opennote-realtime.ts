/**
 * Test Opennote integration with REAL session data from database
 * Run with: npx tsx backend/test-opennote-realtime.ts [sessionId]
 * 
 * If no sessionId provided, will list available sessions
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load environment variables
try {
  const envFile = readFileSync(resolve(__dirname, '.env.local'), 'utf-8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
} catch (error) {
  console.warn('Could not load .env.local')
}

import { createClient } from '@supabase/supabase-js'
import { generateSessionMarkdown, importJournalToOpennote } from './lib/opennote'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  console.log('   Make sure .env.local has:')
  console.log('   - NEXT_PUBLIC_SUPABASE_URL')
  console.log('   - SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function listSessions() {
  console.log('Fetching sessions from database...')
  console.log()
  
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, status, started_at, ended_at, intent_text, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ Error fetching sessions:', error.message)
    return []
  }

  if (!sessions || sessions.length === 0) {
    console.log('No sessions found in database.')
    console.log('   Start a session from the extension first!')
    return []
  }

  console.log(`Found ${sessions.length} session(s):`)
  console.log()
  
  sessions.forEach((session, index) => {
    const startDate = new Date(session.started_at)
    const dateStr = startDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit' 
    })
    
    console.log(`${index + 1}. ${session.id}`)
    console.log(`   Status: ${session.status}`)
    console.log(`   Started: ${dateStr}`)
    console.log(`   Intent: ${session.intent_text || 'None'}`)
    console.log()
  })

  return sessions
}

async function testSessionExport(sessionId: string) {
  console.log('='.repeat(80))
  console.log(`TESTING OPENNOTE EXPORT FOR SESSION: ${sessionId}`)
  console.log('='.repeat(80))
  console.log()

  // Fetch session
  console.log('1. Fetching session data...')
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    console.error('❌ Session not found:', sessionError?.message)
    return
  }

  console.log(`   ✅ Session found: ${session.status}`)
  console.log(`   Started: ${new Date(session.started_at).toLocaleString()}`)
  console.log(`   Intent: ${session.intent_text || 'None'}`)
  console.log()

  // Fetch events
  console.log('2. Fetching events...')
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('session_id', sessionId)
    .order('ts', { ascending: true })

  if (eventsError) {
    console.error('❌ Error fetching events:', eventsError.message)
    return
  }

  console.log(`   ✅ Found ${events?.length || 0} events`)
  if (events && events.length > 0) {
    console.log(`   First event: ${events[0].url}`)
    console.log(`   Last event: ${events[events.length - 1].url}`)
  }
  console.log()

  // Fetch analysis
  console.log('3. Fetching analysis...')
  const { data: analysis, error: analysisError } = await supabase
    .from('analysis')
    .select('summary_json')
    .eq('session_id', sessionId)
    .single()

  if (analysisError && analysisError.code !== 'PGRST116') {
    console.warn('   ⚠️  Analysis not found (will use fallback)')
  } else if (analysis) {
    console.log('   ✅ Analysis found')
  }
  console.log()

  // Prepare session data
  const sessionData = {
    session: {
      id: session.id,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      intent_text: session.intent_text,
      created_at: session.created_at
    },
    events: events || [],
    analysis: analysis?.summary_json || null
  }

  // Generate markdown
  console.log('4. Generating markdown...')
  const markdown = generateSessionMarkdown(sessionData)
  console.log(`   ✅ Markdown generated (${markdown.length} characters)`)
  console.log()
  console.log('Preview:')
  console.log('-'.repeat(80))
  console.log(markdown.substring(0, 500) + '...')
  console.log('-'.repeat(80))
  console.log()

  // Export to Opennote
  console.log('5. Exporting to Opennote...')
  const startDate = new Date(session.started_at)
  const dateStr = startDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit' 
  })
  const title = `FocusForge — Session Recap (${dateStr})`

  try {
    const journalResult = await importJournalToOpennote(markdown, title)
    console.log('   ✅ Journal exported successfully!')
    console.log()
    console.log('='.repeat(80))
    console.log('SUCCESS!')
    console.log('='.repeat(80))
    console.log(`Journal ID: ${journalResult.journalId}`)
    console.log(`Journal URL: ${journalResult.url || `https://opennote.com/journals/${journalResult.journalId}`}`)
    console.log()
    console.log('🎉 You can view the journal at the URL above!')
    console.log('='.repeat(80))
  } catch (error: any) {
    console.error('   ❌ Export failed:', error.message)
    console.log()
    console.log('Make sure:')
    console.log('1. OPENNOTE_API_KEY is set in .env.local')
    console.log('2. The API key is valid')
    console.log('3. You have internet connection')
  }
}

async function main() {
  const sessionId = process.argv[2]

  if (!sessionId) {
    console.log('No session ID provided. Listing available sessions...')
    console.log()
    const sessions = await listSessions()
    
    if (sessions.length > 0) {
      console.log('='.repeat(80))
      console.log('To test a session, run:')
      console.log(`  npx tsx backend/test-opennote-realtime.ts <session-id>`)
      console.log()
      console.log('Example:')
      console.log(`  npx tsx backend/test-opennote-realtime.ts ${sessions[0].id}`)
      console.log('='.repeat(80))
    }
  } else {
    await testSessionExport(sessionId)
  }
}

main().catch(console.error)
