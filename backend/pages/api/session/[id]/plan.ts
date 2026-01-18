import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeAnalysis } from '@/lib/utils'

/**
 * Get task plan for a session.
 * Calls the planning agent with the analysis summary.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID' })
    }

    // Get analysis summary
    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('analysis')
      .select('summary_json')
      .eq('session_id', id)
      .single()

    if (analysisError || !analysis) {
      return res.status(404).json({ error: 'Analysis not found. Session may not be analyzed yet.' })
    }

    // Sanitize analysis
    const analysisSummary = sanitizeAnalysis(analysis.summary_json)

    // Get session for goal
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('intent_text')
      .eq('id', id)
      .single()

    const userGoal = session?.intent_text || null

    // Call planning agent API (internal)
    let taskPlan: any
    try {
      const planResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysisSummary: analysisSummary,
          userGoal: userGoal
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (!planResponse.ok) {
        throw new Error(`Planning API returned ${planResponse.status}`)
      }

      taskPlan = await planResponse.json()
    } catch (planError: any) {
      console.error('Planning API error:', planError)
      // Return basic task plan from analysis
      taskPlan = createBasicTaskPlan(analysisSummary)
    }

    return res.status(200).json({
      sessionId: id,
      analysis: analysisSummary,
      taskPlan: taskPlan
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
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
      description: generateTaskDescription(action),
      reason: 'Suggested from session analysis',
      context: ''
    })
    taskIds.push(taskId)
  })

  // Add pending decisions
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
