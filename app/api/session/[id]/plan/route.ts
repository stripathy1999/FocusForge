import { NextRequest, NextResponse } from 'next/server'
import { getSession, getEvents, getAnalysis } from '@/lib/store'
import { computeSummary } from '@/lib/grouping'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // Get session data from local store
    const session = await getSession(id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const events = await getEvents(id)
    const analysis = await getAnalysis(id)
    const computedSummary = computeSummary(session, events, analysis)

    const MIN_TASK_TIME_SEC = 30
    const meaningfulWorkspaces = computedSummary.domains.filter(
      (workspace) => workspace.timeSec >= MIN_TASK_TIME_SEC
    )

    // Convert to planning agent format
    const analysisSummary = {
      goalInferred: '',
      workspaces: meaningfulWorkspaces.map(d => ({
        label: d.label,
        timeSec: d.timeSec,
        topUrls: d.topUrls,
        topTitles: d.topTitles
      })),
      resumeSummary: computedSummary.resumeSummary || '',
      lastStop: computedSummary.lastStop ? {
        label: computedSummary.lastStop.label || computedSummary.lastStop.title || '',
        url: computedSummary.lastStop.url
      } : { label: '', url: '' },
      nextActions: computedSummary.nextActions || [],
      pendingDecisions: computedSummary.pendingDecisions || []
    }

    // Call planning agent (backend Pages Router API)
    const protocol = process.env.VERCEL_URL ? 'https' : 'http'
    const host = _request.headers.get('host') || 'localhost:3000'
    const planUrl = `${protocol}://${host}/api/plan`

    let taskPlan: any
    try {
      const planResponse = await fetch(planUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysisSummary: analysisSummary,
          userGoal: session.intent_raw || null
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (!planResponse.ok) {
        throw new Error(`Planning API returned ${planResponse.status}`)
      }

      taskPlan = await planResponse.json()
    } catch (planError: any) {
      console.error('Planning API error:', planError)
      // Return basic task plan from analysis as fallback
      taskPlan = createBasicTaskPlan(analysisSummary)
    }

    return NextResponse.json({
      sessionId: id,
      analysis: analysisSummary,
      taskPlan: taskPlan
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Create a basic task plan from analysis (fallback).
 */
function createBasicTaskPlan(analysis: any): any {
  const nextActions = analysis.nextActions || []
  const pendingDecisions = analysis.pendingDecisions || []

  if (!nextActions.length && !pendingDecisions.length) {
    return {
      prioritizedTasks: [
        {
          id: "task_1",
          title:
            "Pick the correct session intent (your browsing didn’t match the intent).",
          priority: "high",
          urgency: "now",
          estimatedTime: "1 minute",
          dependencies: [],
          reason: "Fixes alignment accuracy",
          context: "",
        },
      ],
      taskOrder: ["task_1"],
      suggestions: [
        "Update intent so FocusForge can judge focus correctly.",
      ],
      insights: [
        "No reliable next actions detected (not enough time on specific workspaces).",
      ],
    }
  }

  const tasks: any[] = []
  const taskIds: string[] = []

  // Convert nextActions to tasks
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
      context: ''
    })
    taskIds.push(taskId)
  })

  // Add pending decisions
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
      context: ''
    })
    taskIds.push(taskId)
  })

  return {
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
}