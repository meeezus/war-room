import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { analyzePlan } from '@/lib/plan-analyzer'
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

    // 2. Run real analysis based on flywheel score
    const score = plan.flywheel_score ?? 6
    const analysis = await analyzePlan(
      plan.title ?? 'Untitled',
      plan.raw_markdown ?? '',
      plan.parsed_beads ?? [],
      score,
    )

    // 3. Update plan with analysis and set status to reviewing
    const { data: updated, error: updateError } = await sb
      .from('plans')
      .update({
        analysis,
        status: 'reviewing',
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      captureError(updateError, 'plans/[id]/analyze.POST', { planId: id })
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 4. Emit event
    await sb.from('war_room_events').insert({
      event_type: 'plan_analyzed',
      agent_id: 'system',
      title: `Plan analyzed: ${plan.title ?? id}`,
      description: `${analysis.depth} analysis complete. ${analysis.pushback.length} concerns, ${analysis.blind_spots.length} blind spots.`,
      metadata: {
        plan_id: id,
        depth: analysis.depth,
        flywheel_score: score,
      },
    })

    return NextResponse.json({
      plan: updated,
      analysis,
      status: 'reviewing',
      depth: analysis.depth,
    })
  } catch (err) {
    captureError(err, 'plans/[id]/analyze.POST')
    return NextResponse.json(
      { error: 'Failed to analyze plan' },
      { status: 500 }
    )
  }
}
