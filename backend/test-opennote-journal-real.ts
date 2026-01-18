/**
 * Test Opennote journal export with real session data
 * 
 * Usage:
 *   npx tsx backend/test-opennote-journal-real.ts [sessionId]
 * 
 * If no sessionId provided, fetches the most recent session from database
 */

// Environment variables should be available via process.env
// When running in Next.js backend context, env vars are loaded automatically

async function testJournalExport() {
  const sessionId = process.argv[2]

  // Check if API key is set
  if (!process.env.OPENNOTE_API_KEY) {
    console.error('❌ OPENNOTE_API_KEY environment variable is not set')
    console.log('Please set it in .env.local or .env file')
    process.exit(1)
  }

  console.log('='.repeat(80))
  console.log('TESTING OPENNOTE JOURNAL EXPORT WITH REAL DATA')
  console.log('='.repeat(80))
  console.log(`API URL: ${process.env.OPENNOTE_API_URL || 'https://api.opennote.com'}`)
  console.log(`API Key: ${process.env.OPENNOTE_API_KEY.substring(0, 20)}...`)
  console.log()

  try {
    // If no sessionId provided, fetch the most recent session
    let testSessionId = sessionId

    if (!testSessionId) {
      console.log('No sessionId provided, fetching most recent session...')
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Supabase environment variables not set')
        console.log('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
        process.exit(1)
      }

      const sessionsResponse = await fetch(`${supabaseUrl}/rest/v1/sessions?order=created_at.desc&limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!sessionsResponse.ok) {
        throw new Error(`Failed to fetch sessions: ${sessionsResponse.status} ${await sessionsResponse.text()}`)
      }

      const sessions = await sessionsResponse.json()
      if (!sessions || sessions.length === 0) {
        console.error('❌ No sessions found in database')
        console.log('Please create a session first via the extension or API')
        process.exit(1)
      }

      testSessionId = sessions[0].id
      console.log(`✅ Found session: ${testSessionId}`)
      console.log()
    }

    console.log(`Testing journal export for session: ${testSessionId}`)
    console.log('-'.repeat(80))

    // Test the export endpoint
    const baseUrl = process.env.BACKEND_API_URL || 'http://localhost:3000'
    const exportUrl = `${baseUrl}/api/opennote/journal/export`

    console.log(`Calling: POST ${exportUrl}`)
    console.log(`Body: { sessionId: "${testSessionId}" }`)
    console.log()

    const response = await fetch(exportUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId: testSessionId }),
    })

    const responseText = await response.text()
    console.log(`Response Status: ${response.status} ${response.statusText}`)
    console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()))
    console.log()

    if (!response.ok) {
      console.error('❌ Export failed!')
      console.log('Response:', responseText)
      process.exit(1)
    }

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error('❌ Failed to parse response as JSON')
      console.log('Response:', responseText.substring(0, 500))
      process.exit(1)
    }

    console.log('✅ Export successful!')
    console.log()
    console.log('Response:')
    console.log(JSON.stringify(data, null, 2))
    console.log()

    if (data.journalId) {
      console.log('📝 Journal created in Opennote!')
      console.log(`   Journal ID: ${data.journalId}`)
      if (data.journalUrl) {
        console.log(`   Journal URL: ${data.journalUrl}`)
        console.log(`   Open it here: ${data.journalUrl}`)
      } else {
        console.log(`   Journal URL: https://opennote.com/journal/${data.journalId}`)
      }
    }

    console.log()
    console.log('='.repeat(80))
    console.log('✅ TEST COMPLETED SUCCESSFULLY')
    console.log('='.repeat(80))

  } catch (error: any) {
    console.error('❌ Test failed with error:')
    console.error(error)
    console.error()
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

testJournalExport()