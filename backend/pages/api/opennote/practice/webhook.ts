import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { importJournalToOpennote } from '@/lib/opennote'

interface PracticeWebhookPayload {
  set_id: string
  problems: Array<{
    problem: string
    solution: string
    rubric?: string
    key_points?: string[]
  }>
  session_id?: string
  [key: string]: any
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const payload: PracticeWebhookPayload = req.body

    if (!payload.set_id || !payload.problems) {
      return res.status(400).json({ error: 'Invalid webhook payload' })
    }

    // Find session_id from practice_set_id
    let sessionId = payload.session_id
    if (!sessionId) {
      const { data: exportRecord } = await supabaseAdmin
        .from('opennote_exports')
        .select('session_id')
        .eq('practice_set_id', payload.set_id)
        .single()
      
      if (exportRecord) {
        sessionId = exportRecord.session_id
      }
    }

    // Generate markdown from practice problems
    let markdown = `# Practice Set — Session ${sessionId ? sessionId.slice(0, 8) : 'Unknown'}\n\n`
    markdown += `Generated from your FocusForge session.\n\n`

    for (let i = 0; i < payload.problems.length; i++) {
      const problem = payload.problems[i]
      markdown += `## Problem ${i + 1}\n\n`
      markdown += `${problem.problem}\n\n`
      
      markdown += `### Solution\n\n`
      markdown += `${problem.solution}\n\n`
      
      if (problem.rubric) {
        markdown += `### Rubric\n\n`
        markdown += `${problem.rubric}\n\n`
      }
      
      if (problem.key_points && problem.key_points.length > 0) {
        markdown += `### Key Points\n\n`
        for (const point of problem.key_points) {
          markdown += `- ${point}\n`
        }
        markdown += `\n`
      }
      
      markdown += `---\n\n`
    }

    // Create journal from practice set
    const title = `Practice Set — Session ${sessionId ? sessionId.slice(0, 8) : 'Unknown'}`
    let journalResult
    try {
      journalResult = await importJournalToOpennote(markdown, title)
    } catch (opennoteError: any) {
      console.error('Opennote journal creation error:', opennoteError)
      // Still return success to Opennote (webhook received)
      return res.status(200).json({ 
        ok: true,
        message: 'Webhook received, but journal creation failed',
        error: opennoteError.message
      })
    }

    // Update export record with practice set URL
    if (sessionId) {
      await supabaseAdmin
        .from('opennote_exports')
        .update({
          practice_set_url: journalResult.url || null
        })
        .eq('session_id', sessionId)
        .catch((err) => {
          console.error('Error updating practice set URL:', err)
        })
    }

    return res.status(200).json({
      ok: true,
      journalId: journalResult.journalId,
      journalUrl: journalResult.url,
      message: 'Practice set journal created successfully'
    })
  } catch (error: any) {
    console.error('Webhook processing error:', error)
    // Return 200 to Opennote even on error (webhook was received)
    return res.status(200).json({ 
      ok: true,
      error: error.message,
      message: 'Webhook received but processing failed'
    })
  }
}
