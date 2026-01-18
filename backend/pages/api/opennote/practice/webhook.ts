import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { importJournalToOpennote } from '@/lib/opennote'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { set_id, problems, session_id } = req.body

    // Find session ID from practice set ID stored in database
    let sessionId = session_id
    
    if (!sessionId && set_id) {
      const { data: exportRecord } = await supabaseAdmin
        .from('opennote_exports')
        .select('session_id')
        .eq('practice_set_id', set_id)
        .single()
      
      sessionId = exportRecord?.session_id
    }

    if (!sessionId) {
      console.error('Could not find session ID for practice set:', set_id)
      // Still return success to Opennote (webhook received)
      return res.status(200).json({ 
        ok: true,
        message: 'Webhook received, but session ID not found'
      })
    }

    // Generate markdown from problems
    if (!problems || !Array.isArray(problems) || problems.length === 0) {
      return res.status(200).json({ 
        ok: true,
        message: 'Webhook received, but no problems provided'
      })
    }

    let markdown = `# Practice Set — Session ${sessionId.slice(0, 8)}\n\n`
    markdown += `Generated on ${new Date().toLocaleDateString()}\n\n`

    problems.forEach((problem: any, index: number) => {
      markdown += `## Problem ${index + 1}\n\n`
      
      if (problem.question || problem.problem) {
        markdown += `${problem.question || problem.problem}\n\n`
      }
      
      if (problem.solution) {
        markdown += `### Solution\n\n${problem.solution}\n\n`
      }
      
      if (problem.rubric || problem.key_points) {
        markdown += `### Key Points\n\n${problem.rubric || problem.key_points}\n\n`
      }
      
      markdown += `---\n\n`
    })

    // Create journal with practice set
    let journalResult
    try {
      journalResult = await importJournalToOpennote(markdown, `Practice Set — Session ${sessionId.slice(0, 8)}`)
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
      try {
        await supabaseAdmin
          .from('opennote_exports')
          .update({
            practice_set_url: journalResult.url || null
          })
          .eq('session_id', sessionId)
      } catch (err) {
        console.error('Error updating practice set URL:', err)
      }
    }

    return res.status(200).json({
      ok: true,
      journalId: journalResult.journalId,
      journalUrl: journalResult.url,
      message: 'Practice set journal created successfully'
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    // Still return success to Opennote (webhook received)
    return res.status(200).json({ 
      ok: true,
      message: 'Webhook received, but processing failed',
      error: error.message 
    })
  }
}