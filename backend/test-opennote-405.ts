/**
 * Test the 405 endpoint with different methods and parameters
 * /v1/journals/editor/import_from_markdown returns 405, so it exists!
 */

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

const testMarkdown = `# Test Journal\n\nThis is a test.`
const testTitle = 'FocusForge Test'

async function testMethod(method: string, body?: any) {
  const url = `${apiUrl}/v1/journals/editor/import_from_markdown`
  
  try {
    const options: any = {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    }
    
    if (body) {
      options.headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(body)
    }
    
    const response = await fetch(url, options)
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
  console.log('TESTING /v1/journals/editor/import_from_markdown')
  console.log('='.repeat(80))
  console.log()

  // Test different HTTP methods
  const methods = ['GET', 'POST', 'PUT', 'PATCH']
  
  for (const method of methods) {
    console.log(`Testing ${method} with markdown + title:`)
    const result = await testMethod(method, {
      markdown: testMarkdown,
      title: testTitle
    })
    console.log(`  Status: ${result.status}`)
    if (result.ok) {
      console.log(`  ✅ SUCCESS!`)
      console.log(`  Response:`, JSON.stringify(result.data || result, null, 2))
    } else {
      const responseStr = JSON.stringify(result.data || result.error || result, null, 2)
      console.log(`  Response:`, responseStr.substring(0, 200))
    }
    console.log()
  }

  // Test with query parameters (GET)
  console.log('Testing GET with query parameters:')
  try {
    const url = `${apiUrl}/v1/journals/editor/import_from_markdown?markdown=${encodeURIComponent(testMarkdown)}&title=${encodeURIComponent(testTitle)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    const responseText = await response.text()
    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      data = { text: responseText }
    }
    console.log(`  Status: ${response.status}`)
    console.log(`  Response:`, JSON.stringify(data, null, 2).substring(0, 200))
  } catch (error: any) {
    console.log(`  Error: ${error.message}`)
  }
  console.log()

  // Test different parameter names
  console.log('Testing POST with different parameter names:')
  const paramVariations = [
    { content: testMarkdown, title: testTitle },
    { text: testMarkdown, name: testTitle },
    { markdown_content: testMarkdown, journal_title: testTitle },
    { body: testMarkdown, title: testTitle },
  ]

  for (const params of paramVariations) {
    console.log(`  Testing with: ${Object.keys(params).join(', ')}`)
    const result = await testMethod('POST', params)
    console.log(`    Status: ${result.status}`)
    if (result.ok) {
      console.log(`    ✅ SUCCESS!`)
      console.log(`    Response:`, JSON.stringify(result.data, null, 2))
      break
    } else if (result.status === 422 || result.status === 400) {
      console.log(`    ⚠️  Endpoint exists, wrong params`)
    }
  }

  console.log()
  console.log('='.repeat(80))
  console.log('Check the Opennote API docs for the correct method and parameters')
  console.log('https://docs.opennote.com')
}

runTests()
