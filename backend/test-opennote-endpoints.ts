/**
 * Test different Opennote API endpoint variations
 * This will try common endpoint paths to find the correct one
 */

// Load environment variables
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
  console.warn('Could not load .env.local')
}

const apiKey = process.env.OPENNOTE_API_KEY
const apiUrl = process.env.OPENNOTE_API_URL || 'https://api.opennote.com'

if (!apiKey) {
  console.error('❌ OPENNOTE_API_KEY not found')
  process.exit(1)
}

const testMarkdown = `# Test Journal

This is a test journal created from FocusForge.

## Test Section

Some test content here.`

const testTitle = 'FocusForge Test Journal'

// Test different journal endpoint variations
const journalEndpoints = [
  '/v1/journals',
  '/v1/journals/create',
  '/v1/journals/import',
  '/v1/journals/import_markdown',
  '/v1/journals/editor/import_from_markdown',
  '/v1/journals/editor/import',
  '/v1/journals/markdown',
]

// Test different practice endpoint variations
const practiceEndpoints = [
  '/v1/practice',
  '/v1/practice/create',
  '/v1/practice-sets',
  '/v1/practice-sets/create',
  '/v1/flashcards',
  '/v1/flashcards/create',
]

async function testEndpoint(url: string, body: any, description: string) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    const responseText = await response.text()
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = responseText
    }

    return {
      status: response.status,
      ok: response.ok,
      data: responseData
    }
  } catch (error: any) {
    return {
      status: 0,
      ok: false,
      error: error.message
    }
  }
}

async function runTests() {
  console.log('='.repeat(80))
  console.log('TESTING OPENNOTE API ENDPOINTS')
  console.log('='.repeat(80))
  console.log(`API URL: ${apiUrl}`)
  console.log(`API Key: ${apiKey.substring(0, 20)}...`)
  console.log()

  // Test Journal Endpoints
  console.log('TESTING JOURNAL ENDPOINTS')
  console.log('-'.repeat(80))
  
  for (const endpoint of journalEndpoints) {
    const url = `${apiUrl}${endpoint}`
    console.log(`Testing: ${endpoint}`)
    
    // Try with markdown parameter
    let result = await testEndpoint(url, {
      markdown: testMarkdown,
      title: testTitle
    }, 'Journal with markdown')
    
    if (result.ok) {
      console.log(`✅ SUCCESS! Endpoint works: ${endpoint}`)
      console.log(`   Status: ${result.status}`)
      console.log(`   Response:`, JSON.stringify(result.data, null, 2))
      console.log()
      break
    } else if (result.status === 422 || result.status === 400) {
      // 422/400 means endpoint exists but parameters are wrong
      console.log(`⚠️  Endpoint exists but parameters wrong: ${endpoint}`)
      console.log(`   Status: ${result.status}`)
      console.log(`   Response:`, JSON.stringify(result.data, null, 2))
      console.log()
    } else {
      console.log(`❌ Failed: ${endpoint} (${result.status})`)
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    }
    
    // Try with content parameter instead
    if (!result.ok && result.status !== 422 && result.status !== 400) {
      result = await testEndpoint(url, {
        content: testMarkdown,
        title: testTitle
      }, 'Journal with content')
      
      if (result.ok || result.status === 422 || result.status === 400) {
        console.log(`⚠️  Endpoint might work with 'content' parameter: ${endpoint}`)
        console.log(`   Status: ${result.status}`)
        console.log()
      }
    }
  }

  console.log()
  console.log('TESTING PRACTICE ENDPOINTS')
  console.log('-'.repeat(80))
  
  const practiceDescription = 'Generate practice problems about algorithms and data structures'
  
  for (const endpoint of practiceEndpoints) {
    const url = `${apiUrl}${endpoint}`
    console.log(`Testing: ${endpoint}`)
    
    let result = await testEndpoint(url, {
      set_description: practiceDescription,
      count: 3
    }, 'Practice set')
    
    if (result.ok) {
      console.log(`✅ SUCCESS! Endpoint works: ${endpoint}`)
      console.log(`   Status: ${result.status}`)
      console.log(`   Response:`, JSON.stringify(result.data, null, 2))
      console.log()
      break
    } else if (result.status === 422 || result.status === 400) {
      console.log(`⚠️  Endpoint exists but parameters wrong: ${endpoint}`)
      console.log(`   Status: ${result.status}`)
      console.log(`   Response:`, JSON.stringify(result.data, null, 2))
      console.log()
    } else {
      console.log(`❌ Failed: ${endpoint} (${result.status})`)
    }
  }

  console.log()
  console.log('='.repeat(80))
  console.log('TEST COMPLETE')
  console.log('='.repeat(80))
  console.log()
  console.log('If you found working endpoints, update backend/lib/opennote.ts')
  console.log('with the correct endpoint paths.')
}

runTests()
