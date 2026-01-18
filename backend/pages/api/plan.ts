import type { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import { join } from 'path'

/**
 * Internal API endpoint for planning agent.
 * Calls the Python planning agent.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { analysisSummary, userGoal } = req.body

    if (!analysisSummary) {
      return res.status(400).json({ error: 'Missing analysisSummary' })
    }

    // Check if external planner service URL is configured
    const plannerServiceUrl = process.env.PLANNER_SERVICE_URL

    if (plannerServiceUrl) {
      // Use external planner service
      try {
        const response = await fetch(`${plannerServiceUrl}/plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ analysisSummary, userGoal }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Planner service error: ${errorText}`)
        }

        const result = await response.json()
        return res.status(200).json(result)
      } catch (fetchError: any) {
        console.error('External planner service error:', fetchError)
        throw new Error(`Failed to call planner service: ${fetchError.message}`)
      }
    }

    // Fallback to local Python (for local development)
    const backendDir = process.cwd()
    const projectRoot = join(backendDir, '..')
    const pythonScript = join(projectRoot, 'agent_planner.py')
    
    // Create a simple Python script to call the planner
    const pythonCode = `
import sys
import json
import os
sys.path.insert(0, '${projectRoot}')
from agent_planner import planTasks

input_data = json.loads(sys.stdin.read())
analysis_summary = input_data.get('analysisSummary', {})
user_goal = input_data.get('userGoal')

result = planTasks(
    analysis_summary,
    user_goal=user_goal,
    api_key=os.getenv('GEMINI_API_KEY'),
    use_tools=False  # Disable tools for now (can enable later)
)

print(json.dumps(result))
    `

    const pythonProcess = spawn('python3', ['-c', pythonCode], {
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

    pythonProcess.stdin.write(JSON.stringify({ analysisSummary, userGoal }))
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
      throw new Error(`Python planning failed: ${errorMessage}`)
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
    console.error('Planning error:', error)
    // Return basic task plan instead of error
    const analysisSummary = req.body?.analysisSummary || {}
    const nextActions = analysisSummary.nextActions || []
    const pendingDecisions = analysisSummary.pendingDecisions || []
    
    const generateTaskDescription = (title: string): string => {
      const lowerTitle = title.toLowerCase()
      
      if (lowerTitle.includes('resume') || lowerTitle.includes('open last stop')) {
        return 'Press the "Resume Session" button to reopen the tab or workspace where you left off and continue your work seamlessly.'
      }
      if (lowerTitle.includes('continue in') || lowerTitle.includes('workspace')) {
        return 'Press the "Resume Session" button or use "Continue where you left off" to return to the workspace you were actively using.'
      }
      if (lowerTitle.includes('review') && lowerTitle.includes('pages')) {
        return 'Review the most visited pages from your session to identify key resources and information you were working with.'
      }
      if (lowerTitle.includes('review') && lowerTitle.includes('tabs')) {
        return 'Go through your recent tabs to see what you were working on and identify any unfinished tasks.'
      }
      if (lowerTitle.includes('decide:')) {
        return 'Make a decision on this item based on the context from your session and your current priorities.'
      }
      if (lowerTitle.includes('complete') || lowerTitle.includes('finish')) {
        return 'Complete this task that was started during your session to maintain momentum and avoid losing context.'
      }
      
      return `Work on this task based on your session activity and current priorities.`
    }
    
    const tasks: any[] = []
    const taskIds: string[] = []
    
    nextActions.slice(0, 5).forEach((action: string, i: number) => {
      const taskId = `task_${i + 1}`
      tasks.push({
        id: taskId,
        title: action,
        priority: 'medium',
        urgency: 'soon',
        estimatedTime: '30 minutes',
        dependencies: [],
        description: generateTaskDescription(action),
        reason: 'Suggested from session analysis',
        context: ''
      })
      taskIds.push(taskId)
    })
    
    pendingDecisions.slice(0, 3).forEach((decision: string, i: number) => {
      const taskId = `decision_${i + 1}`
      const title = `Decide: ${decision}`
      tasks.push({
        id: taskId,
        title: title,
        priority: 'high',
        urgency: 'soon',
        estimatedTime: '15 minutes',
        dependencies: [],
        description: generateTaskDescription(title),
        reason: 'Pending decision from session',
        context: ''
      })
      taskIds.push(taskId)
    })
    
    const basicPlan = {
      prioritizedTasks: tasks,
      taskOrder: taskIds,
      suggestions: [
        'Review your session summary to understand what you accomplished',
        'Prioritize tasks based on deadlines and importance'
      ],
      insights: [
        'Tasks generated from session analysis',
        'Consider using calendar to schedule time for these tasks'
      ]
    }
    
    return res.status(200).json(basicPlan)
  }
}
