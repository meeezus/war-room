import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

const DOMAIN_TO_DAIMYO: Record<string, string> = {
  engineering: 'ed',
  product: 'light',
  commerce: 'toji',
  influence: 'power',
  operations: 'major',
  coordination: 'pip',
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { action, projectId } = await request.json()

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Service client unavailable' },
      { status: 500 }
    )
  }

  if (action === 'approve') {
    // 1. Fetch proposal
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      )
    }

    // 2. Update proposal status
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: 'sensei',
        project_id: projectId,
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update proposal' },
        { status: 500 }
      )
    }

    // 3. Get the project's first board
    let boardId: string | null = null
    if (projectId) {
      const { data: board } = await supabase
        .from('boards')
        .select('id')
        .eq('project_id', projectId)
        .limit(1)
        .single()

      boardId = board?.id ?? null
    }

    // 4. Insert task
    const priority =
      proposal.risk_level === 'high'
        ? 1
        : proposal.risk_level === 'medium'
          ? 2
          : 3

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        project_id: projectId,
        board_id: boardId,
        proposal_id: id,
        title: proposal.title,
        status: 'todo',
        goal: proposal.description,
        priority,
      })
      .select()
      .single()

    if (taskError) {
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      )
    }

    // 5. Insert mission
    const daimyoId = DOMAIN_TO_DAIMYO[proposal.domain ?? ''] ?? 'ed'

    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .insert({
        proposal_id: id,
        title: proposal.title,
        assigned_to: daimyoId,
        status: 'queued',
      })
      .select('id, assigned_to')
      .single()

    if (missionError) {
      return NextResponse.json(
        { error: 'Failed to create mission' },
        { status: 500 }
      )
    }

    return NextResponse.json({ task, mission })
  }

  if (action === 'reject') {
    const { error } = await supabase
      .from('proposals')
      .update({ status: 'rejected' })
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to reject proposal' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json(
    { error: 'Invalid action' },
    { status: 400 }
  )
}
