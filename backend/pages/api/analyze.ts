import type { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import { join } from 'path'
import { getSafeDefaultAnalysis } from '../../lib/utils'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { goal, events } = req.body

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Invalid events array' })
    }

    // Check if external analyzer service URL is configured (for Vercel deployment)
    const analyzerServiceUrl = process.env.ANALYZER_SERVICE_URL

    if (analyzerServiceUrl) {
      // Use external Python service (recommended for Vercel)
      try {
        const response = await fetch(`${analyzerServiceUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ goal: goal || '', events }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Analyzer service error: ${errorText}`)
        }

        const result = await response.json()
        return res.status(200).json(result)
      } catch (fetchError: any) {
        console.error('External analyzer service error:', fetchError)
        throw new Error(`Failed to call analyzer service: ${fetchError.message}`)
      }
    }

    // Fallback to local Python (for local development)
    const backendDir = process.cwd()
    const projectRoot = join(backendDir, '..')
    const pythonScript = join(backendDir, 'scripts', 'analyze.py')
    
    const pythonProcess = spawn('python3', [pythonScript], {
      env: {
        ...process.env,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        PYTHONPATH: projectRoot
      },
      cwd: projectRoot
    })

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    pythonProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    pythonProcess.stdin.write(JSON.stringify({ goal: goal || '', events }))
    pythonProcess.stdin.end()

    const exitCode = await new Promise<number>((resolve) => {
      pythonProcess.on('close', (code: number | null) => {
        resolve(code || 0)
      })
    })

    if (exitCode !== 0) {
      let errorMessage = stderr || 'Python process failed'
      try {
        const errorObj = JSON.parse(stderr)
        errorMessage = errorObj.error || errorMessage
      } catch {
        // Not JSON, use as-is
      }
      throw new Error(`Python analysis failed: ${errorMessage}`)
    }

    const output = stdout.trim()
    if (!output) {
      throw new Error('Python script returned empty output')
    }

    try {
      const result = JSON.parse(output)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      return res.status(200).json(result)
    } catch (parseError: any) {
      throw new Error(`Failed to parse Python output: ${parseError.message}\nOutput: ${output}`)
    }
  } catch (error: any) {
    console.error('Analysis error:', error)
    // Return safe default instead of error
    return res.status(200).json(getSafeDefaultAnalysis())
  }
}
