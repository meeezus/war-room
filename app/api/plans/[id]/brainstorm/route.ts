import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { captureError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const sb = createServiceClient()
    if (!sb) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
    }

    // 1. Fetch the plan
    const { data: plan, error } = await sb.from('plans').select('*').eq('id', id).single()
    if (error || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Allow brainstorm from brainstorming or reviewing status (re-brainstorm)
    const allowedStatuses = ['brainstorming', 'reviewing']
    if (!allowedStatuses.includes(plan.status)) {
      return NextResponse.json(
        { error: `Plan is ${plan.status} — brainstorm only works from brainstorming or reviewing` },
        { status: 400 },
      )
    }

    // 2. Set status to brainstorming -- poller handles actual processing
    await sb.from('plans').update({
      status: 'brainstorming',
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    // 3. Emit event
    await sb.from('war_room_events').insert({
      event_type: 'plan_brainstormed',
      agent_id: 'system',
      title: `Brainstorm queued: ${plan.title}`,
      metadata: { plan_id: id },
    })

    return NextResponse.json({
      success: true,
      status: 'brainstorming',
      message: 'Queued for processing',
    })
  } catch (err) {
    captureError(err, 'plans/[id]/brainstorm.POST')
    return NextResponse.json({ error: 'Brainstorm failed' }, { status: 500 })
  }
}
