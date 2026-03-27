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
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 500 }
      )
    }

    // 1. Fetch the plan
    const { data: plan, error: fetchError } = await sb
      .from('plans')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // 2. Set status to analyzing -- poller handles actual processing
    await sb.from('plans').update({
      status: 'analyzing',
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    // 3. Emit event
    await sb.from('war_room_events').insert({
      event_type: 'plan_ingested',
      agent_id: 'system',
      title: `Analysis queued: ${plan.title ?? id}`,
      metadata: { plan_id: id },
    })

    return NextResponse.json({
      success: true,
      status: 'analyzing',
      message: 'Queued for processing',
    })
  } catch (err) {
    captureError(err, 'plans/[id]/analyze.POST')
    return NextResponse.json(
      { error: 'Failed to analyze plan' },
      { status: 500 }
    )
  }
}
