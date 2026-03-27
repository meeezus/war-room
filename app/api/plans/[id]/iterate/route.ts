import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { captureError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { feedback } = await request.json()

    if (!feedback?.trim()) {
      return NextResponse.json({ error: 'feedback required' }, { status: 400 })
    }

    const sb = createServiceClient()
    if (!sb) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
    }

    // 1. Fetch the plan
    const { data: plan, error } = await sb.from('plans').select('*').eq('id', id).single()
    if (error || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // 2. Save feedback and set status -- poller picks it up
    await sb.from('plans').update({
      iteration_feedback: feedback,
      status: 'brainstorming',
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    // 3. Emit event
    await sb.from('war_room_events').insert({
      event_type: 'plan_iterate_requested',
      agent_id: 'system',
      title: `Iterate requested: ${plan.title}`,
      metadata: { plan_id: id, feedback_length: feedback.length },
    })

    return NextResponse.json({
      success: true,
      status: 'brainstorming',
      message: 'Queued for processing',
    })
  } catch (err) {
    captureError(err, 'plans/[id]/iterate.POST')
    return NextResponse.json({ error: 'Iterate failed' }, { status: 500 })
  }
}
