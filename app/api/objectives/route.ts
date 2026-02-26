import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { captureError } from '@/lib/sentry'

export async function POST(req: NextRequest) {
  try {
    const { title, description, success_criteria, project_id, max_iterations } = await req.json()

    if (!title || !description || !success_criteria) {
      return Response.json(
        { error: 'title, description, and success_criteria are required' },
        { status: 400 }
      )
    }

    const sb = createServiceClient()
    if (!sb) {
      return Response.json({ error: 'Service unavailable' }, { status: 500 })
    }

    // 1. Create the objective
    const { data: objective, error: objError } = await sb
      .from('objectives')
      .insert({
        title,
        description,
        success_criteria,
        project_id: project_id || null,
        max_iterations: max_iterations || 5,
        status: 'active',
        created_by: 'sensei',
      })
      .select()
      .single()

    if (objError) throw objError

    // Objective created — the evaluator will propose specific missions
    // when it detects no active work toward the success criteria.
    return Response.json({ objective })
  } catch (err) {
    captureError(err, 'objectives.POST')
    return Response.json({ error: 'Failed to create objective' }, { status: 500 })
  }
}
