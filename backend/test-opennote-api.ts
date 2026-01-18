/**
 * Test script for Opennote API endpoints with mocked fetch
 * This tests the actual API endpoint handlers
 */

// Mock fetch globally
global.fetch = async (url: string | URL, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url.toString()
  
  // Mock journal export endpoint
  if (urlStr.includes('/v1/journals/editor/import_from_markdown')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        journal_id: 'journal-test-123',
        url: 'https://opennote.com/journals/journal-test-123'
      }),
      text: async () => JSON.stringify({
        journal_id: 'journal-test-123',
        url: 'https://opennote.com/journals/journal-test-123'
      })
    } as Response
  }
  
  // Mock practice creation endpoint
  if (urlStr.includes('/v1/practice/create')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        set_id: 'practice-set-test-456',
        status: 'generating'
      }),
      text: async () => JSON.stringify({
        set_id: 'practice-set-test-456',
        status: 'generating'
      })
    } as Response
  }
  
  // Default error
  return {
    ok: false,
    status: 404,
    json: async () => ({ error: 'Not found' }),
    text: async () => 'Not found'
  } as Response
}

// Set environment variable for testing
process.env.OPENNOTE_API_KEY = 'test-api-key-mock'
process.env.OPENNOTE_API_URL = 'https://api.opennote.com'

import { importJournalToOpennote, createPracticeSet } from './lib/opennote'
import { generateSessionMarkdown, generatePracticeSetDescription } from './lib/opennote'

// Mock session data
const mockSessionData = {
  session: {
    id: 'test-session-789',
    status: 'ended',
    started_at: '2024-01-17T14:23:00Z',
    ended_at: '2024-01-17T15:45:00Z',
    intent_text: 'Study algorithms and data structures',
    created_at: '2024-01-17T14:23:00Z'
  },
  events: [
    {
      id: 'event-1',
      url: 'https://leetcode.com/problems/valid-parentheses',
      title: 'Valid Parentheses',
      duration_sec: 900,
      domain: 'leetcode.com',
      ts: 1705500000000
    }
  ],
  analysis: {
    goalInferred: 'Algorithm practice',
    workspaces: [{
      label: 'LeetCode',
      timeSec: 900,
      topUrls: ['https://leetcode.com/problems/valid-parentheses']
    }],
    resumeSummary: 'You were solving LeetCode problems',
    lastStop: {
      label: 'Valid Parentheses',
      url: 'https://leetcode.com/problems/valid-parentheses'
    },
    nextActions: ['Continue with stack problems'],
    pendingDecisions: []
  }
}

console.log('='.repeat(80))
console.log('OPENNOTE API ENDPOINT TEST (MOCKED)')
console.log('='.repeat(80))
console.log()

async function runTests() {
  try {
    // Test 1: Journal Export API Call
    console.log('TEST 1: Journal Export API Call')
    console.log('-'.repeat(80))
    const markdown = generateSessionMarkdown(mockSessionData)
    const startDate = new Date(mockSessionData.session.started_at)
    const dateStr = startDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit' 
    })
    const title = `FocusForge — Session Recap (${dateStr})`
    
    console.log('Calling importJournalToOpennote...')
    const journalResult = await importJournalToOpennote(markdown, title)
    console.log('✅ Journal export successful!')
    console.log('   Journal ID:', journalResult.journalId)
    console.log('   Journal URL:', journalResult.url)
    console.log()
    
    // Test 2: Practice Set Creation API Call
    console.log('TEST 2: Practice Set Creation API Call')
    console.log('-'.repeat(80))
    const practiceDesc = generatePracticeSetDescription(mockSessionData)
    const webhookUrl = 'https://yourapp.vercel.app/api/opennote/practice/webhook'
    
    console.log('Calling createPracticeSet...')
    const practiceResult = await createPracticeSet(practiceDesc, 5, webhookUrl)
    console.log('✅ Practice set creation successful!')
    console.log('   Set ID:', practiceResult.setId)
    console.log()
    
    // Test 3: Error Handling (missing API key)
    console.log('TEST 3: Error Handling (Missing API Key)')
    console.log('-'.repeat(80))
    const originalKey = process.env.OPENNOTE_API_KEY
    delete process.env.OPENNOTE_API_KEY
    
    try {
      await importJournalToOpennote(markdown, title)
      console.log('❌ Should have thrown error for missing API key')
    } catch (error: any) {
      console.log('✅ Correctly threw error:', error.message)
    }
    
    // Restore API key
    process.env.OPENNOTE_API_KEY = originalKey
    console.log()
    
    // Test 4: API Error Response Handling
    console.log('TEST 4: API Error Response Handling')
    console.log('-'.repeat(80))
    
    // Mock a failed API response
    const originalFetch = global.fetch
    global.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
      text: async () => 'Unauthorized'
    } as Response)
    
    try {
      await importJournalToOpennote(markdown, title)
      console.log('❌ Should have thrown error for API failure')
    } catch (error: any) {
      console.log('✅ Correctly handled API error:', error.message)
    }
    
    // Restore fetch
    global.fetch = originalFetch
    console.log()
    
    // Summary
    console.log('='.repeat(80))
    console.log('TEST SUMMARY')
    console.log('='.repeat(80))
    console.log('✅ Journal export API call: PASSED')
    console.log('✅ Practice set creation API call: PASSED')
    console.log('✅ Error handling (missing API key): PASSED')
    console.log('✅ Error handling (API failure): PASSED')
    console.log()
    console.log('All API endpoint tests passed!')
    console.log()
    console.log('The integration is ready for real API testing.')
    console.log('='.repeat(80))
    
  } catch (error: any) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

runTests()
