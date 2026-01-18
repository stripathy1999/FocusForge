/**
 * Test Opennote integration with REAL API
 * Run with: npx tsx backend/test-opennote-real.ts
 * 
 * WARNING: This makes real API calls to Opennote
 * 
 * Make sure .env.local exists with OPENNOTE_API_KEY set
 */

// Load environment variables from .env.local
import { readFileSync } from 'fs'
import { resolve } from 'path'

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
  console.warn('Could not load .env.local, using process.env')
}

import { generateSessionMarkdown, importJournalToOpennote, generatePracticeSetDescription, createPracticeSet } from './lib/opennote'

// Mock session data for testing
const mockSessionData = {
  session: {
    id: 'test-session-real-123',
    status: 'ended',
    started_at: '2024-01-17T14:23:00Z',
    ended_at: '2024-01-17T15:45:00Z',
    intent_text: 'Test Opennote integration',
    created_at: '2024-01-17T14:23:00Z'
  },
  events: [
    {
      id: 'event-1',
      url: 'https://leetcode.com/problems/two-sum',
      title: 'Two Sum - LeetCode',
      duration_sec: 600,
      domain: 'leetcode.com',
      ts: 1705500000000
    },
    {
      id: 'event-2',
      url: 'https://docs.google.com/document/d/test',
      title: 'Test Document',
      duration_sec: 300,
      domain: 'docs.google.com',
      ts: 1705500600000
    }
  ],
  analysis: {
    goalInferred: 'Testing Opennote API integration',
    workspaces: [
      {
        label: 'LeetCode Practice',
        timeSec: 600,
        topUrls: ['https://leetcode.com/problems/two-sum']
      },
      {
        label: 'Documentation',
        timeSec: 300,
        topUrls: ['https://docs.google.com/document/d/test']
      }
    ],
    resumeSummary: 'Testing Opennote integration with real API calls',
    lastStop: {
      label: 'Test Document',
      url: 'https://docs.google.com/document/d/test'
    },
    nextActions: ['Verify API integration works'],
    pendingDecisions: []
  }
}

async function testRealAPI() {
  console.log('='.repeat(80))
  console.log('OPENNOTE REAL API TEST')
  console.log('='.repeat(80))
  console.log()

  // Check API key
  const apiKey = process.env.OPENNOTE_API_KEY
  if (!apiKey) {
    console.error('❌ OPENNOTE_API_KEY not found in environment')
    console.log('   Make sure .env.local exists with OPENNOTE_API_KEY set')
    process.exit(1)
  }

  console.log('✅ API Key found:', apiKey.substring(0, 20) + '...')
  console.log()

  try {
    // Test 1: Generate markdown
    console.log('TEST 1: Generate Markdown')
    console.log('-'.repeat(80))
    const markdown = generateSessionMarkdown(mockSessionData)
    console.log('✅ Markdown generated')
    console.log(`   Length: ${markdown.length} characters`)
    console.log(`   Preview: ${markdown.substring(0, 100)}...`)
    console.log()

    // Test 2: Export to Opennote Journal (REAL API CALL)
    console.log('TEST 2: Export to Opennote Journal (REAL API)')
    console.log('-'.repeat(80))
    const startDate = new Date(mockSessionData.session.started_at)
    const dateStr = startDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit' 
    })
    const title = `FocusForge Test — ${dateStr}`

    console.log('Calling Opennote API...')
    console.log('Title:', title)
    
    try {
      const journalResult = await importJournalToOpennote(markdown, title)
      console.log('✅ Journal export successful!')
      console.log('   Journal ID:', journalResult.journalId)
      console.log('   Journal URL:', journalResult.url || 'N/A')
      console.log()
      console.log('🎉 SUCCESS! You can view the journal at:', journalResult.url || `https://opennote.com/journals/${journalResult.journalId}`)
      console.log()
    } catch (error: any) {
      console.error('❌ Journal export failed:', error.message)
      console.log()
      console.log('This might be due to:')
      console.log('1. Invalid API key')
      console.log('2. Incorrect API endpoint URL')
      console.log('3. Network issues')
      console.log('4. Opennote API changes')
      console.log()
      console.log('Error details:', error)
      console.log()
    }

    // Test 3: Generate Practice Set Description
    console.log('TEST 3: Generate Practice Set Description')
    console.log('-'.repeat(80))
    const practiceDesc = generatePracticeSetDescription(mockSessionData)
    console.log('✅ Practice description generated')
    console.log('Description:')
    console.log(practiceDesc)
    console.log()

    // Test 4: Create Practice Set (REAL API CALL)
    console.log('TEST 4: Create Practice Set (REAL API)')
    console.log('-'.repeat(80))
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/opennote/practice/webhook`
      : 'https://yourapp.vercel.app/api/opennote/practice/webhook'
    
    console.log('Calling Opennote Practice API...')
    console.log('Webhook URL:', webhookUrl)
    
    try {
      const practiceResult = await createPracticeSet(practiceDesc, 3, webhookUrl)
      console.log('✅ Practice set creation successful!')
      console.log('   Set ID:', practiceResult.setId)
      console.log()
      console.log('🎉 SUCCESS! Practice set is being generated.')
      console.log('   Webhook will be called when ready.')
      console.log()
    } catch (error: any) {
      console.error('❌ Practice set creation failed:', error.message)
      console.log()
      console.log('This might be due to:')
      console.log('1. Invalid API key')
      console.log('2. Incorrect API endpoint URL')
      console.log('3. Practice API not available')
      console.log('4. Network issues')
      console.log()
      console.log('Error details:', error)
      console.log()
    }

    // Summary
    console.log('='.repeat(80))
    console.log('TEST SUMMARY')
    console.log('='.repeat(80))
    console.log('✅ Markdown generation: PASSED')
    console.log('✅ Practice description: PASSED')
    console.log('⏳ Journal export: Check results above')
    console.log('⏳ Practice set: Check results above')
    console.log()
    console.log('='.repeat(80))

  } catch (error: any) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testRealAPI()
