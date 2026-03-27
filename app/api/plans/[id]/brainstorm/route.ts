import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { brainstormPlan } from '@/lib/plan-brainstorm'
import { parsePlanMarkdown } from '@/lib/plan-parser'
import { captureError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

    // 2. Brainstorm
    const result = await brainstormPlan(plan.raw_markdown)
    if (!result) {
      return NextResponse.json(
        { error: 'Brainstorm failed — check ANTHROPIC_API_KEY' },
        { status: 500 },
      )
    }

    // 3. Parse the brainstormed markdown into beads
    const parsed = parsePlanMarkdown(result.markdown)

    // 4. Update the plan with structured beads
    const newStatus = parsed.flywheelScore <= 4 ? 'reviewing' : 'analyzing'

    await sb.from('plans').update({
      title: parsed.title || plan.title,
      raw_markdown: result.markdown,
      parsed_beads: parsed.beads,
      flywheel_score: parsed.flywheelScore,
      score_breakdown: parsed.scoreBreakdown,
      wave_count: parsed.waveCount,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    // 5. Emit event
    await sb.from('war_room_events').insert({
      event_type: 'plan_brainstormed',
      agent_id: 'system',
      title: `Plan brainstormed (${result.mode} mode): ${parsed.title}`,
      description: `${parsed.beads.length} beads, ${parsed.waveCount} waves, score ${parsed.flywheelScore}. Mode: ${result.mode}.`,
      metadata: { plan_id: id, mode: result.mode, bead_count: parsed.beads.length },
    })

    // 6. If score 5+, auto-trigger analysis (fire and forget)
    if (newStatus === 'analyzing') {
      const { analyzePlan } = await import('@/lib/plan-analyzer')
      analyzePlan(parsed.title, result.markdown, parsed.beads, parsed.flywheelScore)
        .then(async (analysis) => {
          await sb.from('plans').update({
            analysis,
            status: 'reviewing',
            updated_at: new Date().toISOString(),
          }).eq('id', id)
        })
        .catch((err) => captureError(err, 'plans/[id]/brainstorm.analyze', { planId: id }))
    }

    return NextResponse.json({
      success: true,
      mode: result.mode,
      beadCount: parsed.beads.length,
      waveCount: parsed.waveCount,
      flywheelScore: parsed.flywheelScore,
      status: newStatus,
    })
  } catch (err) {
    captureError(err, 'plans/[id]/brainstorm.POST')
    return NextResponse.json({ error: 'Brainstorm failed' }, { status: 500 })
  }
}
