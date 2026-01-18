import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { existsSync } from 'fs'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { analysisSummary, userGoal } = body || {}
  if (!analysisSummary) {
    return NextResponse.json({ error: 'Missing analysisSummary' }, { status: 400 })
  }

  try {
    const plannerServiceUrl = process.env.PLANNER_SERVICE_URL
    if (plannerServiceUrl) {
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
      return NextResponse.json(result)
    }

    const projectRoot = process.cwd()
    const pythonScriptPath = `${projectRoot}/agent_planner.py`
    if (!existsSync(pythonScriptPath)) {
      return NextResponse.json(createBasicTaskPlan(analysisSummary))
    }

    const pythonCmd =
      process.env.PYTHON_BINARY ||
      (process.platform === 'win32' ? 'python' : 'python3')

    const pythonCode = `
import sys
import json
import os
sys.path.insert(0, ${JSON.stringify(projectRoot)})
from agent_planner import planTasks

input_data = json.loads(sys.stdin.read())
analysis_summary = input_data.get('analysisSummary', {})
user_goal = input_data.get('userGoal')

result = planTasks(
    analysis_summary,
    user_goal=user_goal,
    api_key=os.getenv('GEMINI_API_KEY'),
    use_tools=False
)

print(json.dumps(result))
    `

    const pythonProcess = spawn(pythonCmd, ['-c', pythonCode], {
      env: {
        ...process.env,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        PYTHONPATH: projectRoot,
      },
      cwd: projectRoot,
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
        // Keep stderr as-is when it isn't JSON.
      }
      throw new Error(`Python planning failed: ${errorMessage}`)
    }

    const output = stdout.trim()
    if (!output) {
      throw new Error('Python script returned empty output')
    }

    const result = JSON.parse(output)
    if (result?.error) {
      throw new Error(result.error)
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Planning error:', error)
    return NextResponse.json(createBasicTaskPlan(analysisSummary))
  }
}

function createBasicTaskPlan(analysis: any): any {
  const nextActions = analysis?.nextActions || []
  const pendingDecisions = analysis?.pendingDecisions || []

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
      reason: 'Suggested from session analysis',
      context: '',
    })
    taskIds.push(taskId)
  })

  pendingDecisions.slice(0, 3).forEach((decision: string, i: number) => {
    const taskId = `decision_${i + 1}`
    tasks.push({
      id: taskId,
      title: `Decide: ${decision}`,
      priority: 'high',
      urgency: 'soon',
      estimatedTime: '15 minutes',
      dependencies: [],
      reason: 'Pending decision from session',
      context: '',
    })
    taskIds.push(taskId)
  })

  return {
    prioritizedTasks: tasks,
    taskOrder: taskIds,
    suggestions: [
      'Review your session summary to understand what you accomplished',
      'Prioritize tasks based on deadlines and importance',
    ],
    insights: [
      'Tasks generated from session analysis',
      'Consider using calendar to schedule time for these tasks',
    ],
  }
}
