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
      intentTags: session.intent_tags ?? [],
      workspaces: meaningfulWorkspaces.map(d => ({
        label: d.label,
        timeSec: d.timeSec,
        topUrls: d.topUrls,
        topTitles: d.topTitles
      })),
      focus: computedSummary.focus,
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
 * Generate a description for a task based on its title.
 */
function generateTaskDescription(title: string): string {
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
  
  // Default description
  return `Work on this task based on your session activity and current priorities.`
}

/**
 * Create a basic task plan from analysis (fallback).
 */
function createBasicTaskPlan(analysis: any): any {
  const nextActions = analysis.nextActions || []
  const pendingDecisions = analysis.pendingDecisions || []
  const intentTags = analysis.intentTags || []
  const workspaces = analysis.workspaces || []
  const topWorkspace = workspaces[0]
  const focus = analysis.focus || {}
  const totalTimeSec =
    focus.totalTimeSec ?? workspaces.reduce((sum: number, w: any) => sum + (w.timeSec || 0), 0)
  const alignedSec = focus.alignedTimeSec ?? 0
  const offIntentSec = focus.offIntentTimeSec ?? 0
  const unknownSec = focus.unknownTimeSec ?? 0

  const tasks: any[] = []
  const taskIds: string[] = []
  const suggestions: string[] = []
  const insights: string[] = []

  const pushTask = (task: any) => {
    tasks.push(task)
    taskIds.push(task.id)
  }

  if (!intentTags.length) {
    pushTask({
      id: "intent_1",
      title: "Set the correct session intent to get accurate focus tracking.",
      priority: "high",
      urgency: "now",
      estimatedTime: "1 minute",
      dependencies: [],
      reason: "FocusForge needs intent to judge alignment",
      context: "",
    })
    suggestions.push("Add your intent so tasks match what you actually wanted to do.")
  }

  if (analysis.lastStop?.url) {
    pushTask({
      id: "resume_1",
      title: `Resume last stop: ${analysis.lastStop.label || "last tab"}`,
      priority: "high",
      urgency: "now",
      estimatedTime: "5 minutes",
      dependencies: [],
      description: generateTaskDescription("open last stop"),
      reason: "Fastest way to regain context",
      context: analysis.lastStop.url,
    })
  }

  if (topWorkspace?.label) {
    pushTask({
      id: "focus_1",
      title: `Continue in ${topWorkspace.label}`,
      priority: "medium",
      urgency: "soon",
      estimatedTime: "25 minutes",
      dependencies: [],
      description: generateTaskDescription(`Continue in ${topWorkspace.label} workspace`),
      reason: "Most active workspace in this session",
      context: "",
    })
  }

  if (totalTimeSec > 0 && offIntentSec > alignedSec) {
    pushTask({
      id: "refocus_1",
      title: "Refocus on your intent and close off‑intent tabs.",
      priority: "high",
      urgency: "now",
      estimatedTime: "5 minutes",
      dependencies: [],
      reason: "Off‑intent time exceeded aligned time",
      context: "",
    })
    suggestions.push("Return to your intent by reopening your last focused tab.")
  } else if (totalTimeSec > 0 && alignedSec > 0) {
    suggestions.push("Keep momentum on your aligned work while it is fresh.")
  } else if (unknownSec > 0) {
    suggestions.push("Revisit recent tabs to clarify which ones match your intent.")
  }

  // Convert nextActions to tasks
  nextActions.slice(0, 5).forEach((action: string, i: number) => {
    const taskId = `task_${i + 1}`
    pushTask({
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
  })

  // Add pending decisions
  pendingDecisions.slice(0, 3).forEach((decision: string, i: number) => {
    const taskId = `decision_${i + 1}`
    const title = `Decide: ${decision}`
    pushTask({
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
  })

  if (!tasks.length) {
    pushTask({
      id: "task_1",
      title: "Review your recent tabs and pick a focus to continue.",
      priority: "medium",
      urgency: "soon",
      estimatedTime: "10 minutes",
      dependencies: [],
      reason: "No reliable next actions detected",
      context: "",
    })
    insights.push("Not enough signal to auto‑generate tasks yet.")
  }

  if (!suggestions.length) {
    suggestions.push("Prioritize tasks based on deadlines and importance.")
  }
  if (!insights.length) {
    insights.push("Tasks generated from session analysis.")
  }

  return {
    prioritizedTasks: tasks,
    taskOrder: taskIds,
    suggestions,
    insights,
  }
}