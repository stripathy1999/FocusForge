/**
 * Test Opennote integration with REAL session data via API
 * Run with: npx tsx backend/test-opennote-realtime-api.ts [sessionId]
 * 
 * This uses the backend API endpoints instead of direct database access
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

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function listSessions() {
  console.log('Fetching sessions from API...')
  console.log()
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/sessions`)
    if (!response.ok) {
      console.error(`❌ API error: ${response.status}`)
      return []
    }
    
    const data = await response.json()
    const sessions = data.sessions || []
    
    if (sessions.length === 0) {
      console.log('No sessions found.')
      console.log('   Start a session from the extension first!')
      return []
    }

    console.log(`Found ${sessions.length} session(s):`)
    console.log()
    
    sessions.forEach((session: any, index: number) => {
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
  } catch (error: any) {
    console.error('❌ Error fetching sessions:', error.message)
    console.log()
    console.log('Make sure:')
    console.log('1. Backend server is running (npm run dev in backend/)')
    console.log('2. NEXT_PUBLIC_APP_URL is correct (default: http://localhost:3000)')
    return []
  }
}

async function testSessionExport(sessionId: string) {
  console.log('='.repeat(80))
  console.log(`TESTING OPENNOTE EXPORT FOR SESSION: ${sessionId}`)
  console.log('='.repeat(80))
  console.log()

  // Fetch session data from API
  console.log('1. Fetching session data from API...')
  try {
    const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}`)
    
    if (!response.ok) {
      console.error(`❌ API error: ${response.status}`)
      const errorText = await response.text()
      console.error(`   ${errorText}`)
      return
    }

    const data = await response.json()
    const { session, events, analysis } = data

    console.log(`   ✅ Session found: ${session.status}`)
    console.log(`   Started: ${new Date(session.started_at).toLocaleString()}`)
    console.log(`   Intent: ${session.intent_text || 'None'}`)
    console.log(`   Events: ${events?.length || 0}`)
    console.log(`   Analysis: ${analysis ? 'Yes' : 'No'}`)
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
      analysis: analysis || null
    }

    // Generate markdown
    console.log('2. Generating markdown...')
    const { generateSessionMarkdown } = await import('./lib/opennote')
    const markdown = generateSessionMarkdown(sessionData)
    console.log(`   ✅ Markdown generated (${markdown.length} characters)`)
    console.log()
    console.log('Preview:')
    console.log('-'.repeat(80))
    console.log(markdown.substring(0, 500) + '...')
    console.log('-'.repeat(80))
    console.log()

    // Export to Opennote via API
    console.log('3. Exporting to Opennote via API...')
    const exportResponse = await fetch(`${API_BASE_URL}/api/opennote/journal/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId })
    })

    if (!exportResponse.ok) {
      const errorData = await exportResponse.json()
      console.error('   ❌ Export failed:', errorData.error || exportResponse.statusText)
      return
    }

    const exportData = await exportResponse.json()
    console.log('   ✅ Journal exported successfully!')
    console.log()
    console.log('='.repeat(80))
    console.log('SUCCESS!')
    console.log('='.repeat(80))
    console.log(`Journal ID: ${exportData.journalId}`)
    console.log(`Journal URL: ${exportData.journalUrl || `https://opennote.com/journals/${exportData.journalId}`}`)
    console.log()
    console.log('🎉 You can view the journal at the URL above!')
    console.log('='.repeat(80))

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.log()
    console.log('Make sure:')
    console.log('1. Backend server is running (npm run dev in backend/)')
    console.log('2. OPENNOTE_API_KEY is set in backend/.env.local')
    console.log('3. The session ID is valid')
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
      console.log(`  npx tsx backend/test-opennote-realtime-api.ts <session-id>`)
      console.log()
      console.log('Example:')
      console.log(`  npx tsx backend/test-opennote-realtime-api.ts ${sessions[0].id}`)
      console.log('='.repeat(80))
    }
  } else {
    await testSessionExport(sessionId)
  }
}

main().catch(console.error)
