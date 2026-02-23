import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

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

    // 2. Create an initial proposal linked to this objective
    const { data: proposal, error: propError } = await sb
      .from('proposals')
      .insert({
        title: `[Objective] ${title}`,
        description,
        source: 'shoin_chat',
        requested_by: 'sensei',
        project_id: project_id || null,
        objective_id: objective.id,
        status: 'pending',
        auto_approved: false,
        council_review: false,
        reviews: [],
      })
      .select()
      .single()

    if (propError) throw propError

    return Response.json({ objective, proposal })
  } catch (err) {
    console.error('[objectives/route] Error:', err)
    return Response.json({ error: 'Failed to create objective' }, { status: 500 })
  }
}
