/**
 * Test Practice Set generation with REAL session data from database
 * Run with: npx tsx backend/test-practice-realtime.ts [sessionId]
 * 
 * This tests the full flow: session data -> practice description -> Opennote API
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

async function testPracticeGeneration(sessionId: string) {
  console.log('='.repeat(80))
  console.log(`TESTING PRACTICE SET GENERATION FOR SESSION: ${sessionId}`)
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

    // Generate practice description
    console.log('2. Generating practice set description...')
    const { generatePracticeSetDescription } = await import('./lib/opennote')
    
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
    
    const practiceDesc = generatePracticeSetDescription(sessionData)
    console.log(`   ✅ Practice description generated (${practiceDesc.length} characters)`)
    console.log()
    console.log('Description:')
    console.log('-'.repeat(80))
    console.log(practiceDesc)
    console.log('-'.repeat(80))
    console.log()

    // Call practice creation API
    console.log('3. Creating practice set via API...')
    const practiceResponse = await fetch(`${API_BASE_URL}/api/opennote/practice/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId })
    })

    if (!practiceResponse.ok) {
      let errorData
      try {
        errorData = await practiceResponse.json()
      } catch {
        const text = await practiceResponse.text()
        errorData = { error: text }
      }
      console.error('   ❌ Practice creation failed:', errorData.error || practiceResponse.statusText)
      console.log()
      console.log('This might mean:')
      console.log('1. Opennote Practice API endpoint doesn\'t exist (404)')
      console.log('2. Backend API route is not accessible')
      console.log('3. OPENNOTE_API_KEY is not set or invalid')
      console.log()
      console.log('Error details:', JSON.stringify(errorData, null, 2))
      return
    }

    const practiceData = await practiceResponse.json()
    console.log('   ✅ Practice set creation initiated!')
    console.log()
    console.log('='.repeat(80))
    console.log('SUCCESS!')
    console.log('='.repeat(80))
    console.log(`Set ID: ${practiceData.setId}`)
    console.log(`Status: ${practiceData.message || 'Creating...'}`)
    console.log()
    
    if (practiceData.setId) {
      console.log('📝 Practice set is being generated by Opennote.')
      console.log('   It will be delivered via webhook when ready.')
      console.log('   Check the webhook endpoint: /api/opennote/practice/webhook')
      console.log()
      console.log('⚠️  Note: The practice set endpoint might not be available in Opennote API.')
      console.log('   If you see a 404, the endpoint path may need to be updated.')
    }
    
    console.log('='.repeat(80))

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.log()
    console.log('Make sure:')
    console.log('1. Backend server is running (npm run dev in backend/)')
    console.log('2. OPENNOTE_API_KEY is set in backend/.env.local')
    console.log('3. The session ID is valid')
    console.log()
    console.log('Full error:', error)
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
      console.log('To test practice generation, run:')
      console.log(`  npx tsx backend/test-practice-realtime.ts <session-id>`)
      console.log()
      console.log('Example:')
      console.log(`  npx tsx backend/test-practice-realtime.ts ${sessions[0].id}`)
      console.log('='.repeat(80))
    }
  } else {
    await testPracticeGeneration(sessionId)
  }
}

main().catch(console.error)
