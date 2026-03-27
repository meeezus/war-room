import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { brainstormPlan } from '@/lib/plan-brainstorm'
import { parsePlanMarkdown } from '@/lib/plan-parser'
import { syncPlanToVault } from '@/lib/vault-sync'
import { captureError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

    // 2. Combine original idea + previous beads context + new feedback
    const context = [
      `Original idea: ${plan.raw_markdown}`,
      plan.parsed_beads?.length
        ? `\n\nPrevious beads:\n${plan.parsed_beads.map((b: { id: string; title: string }) => `- ${b.id}: ${b.title}`).join('\n')}`
        : '',
      `\n\nUser feedback for iteration:\n${feedback}`,
      '\n\nPlease incorporate this feedback into an updated plan with beads.',
    ].join('')

    // 3. Update status to brainstorming
    await sb.from('plans').update({
      status: 'brainstorming',
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    // 4. Re-brainstorm with combined context
    const result = await brainstormPlan(context)
    if (!result) {
      await sb.from('plans').update({ status: 'reviewing' }).eq('id', id)
      return NextResponse.json(
        { error: 'Iterate failed — brainstorm returned null' },
        { status: 500 },
      )
    }

    // 5. Parse the brainstormed markdown into beads
    const parsed = parsePlanMarkdown(result.markdown)
    const newStatus = parsed.flywheelScore <= 4 ? 'reviewing' : 'analyzing'

    // 6. Update the plan with structured beads
    const updatedFields = {
      title: parsed.title || plan.title,
      raw_markdown: result.markdown,
      parsed_beads: parsed.beads,
      flywheel_score: parsed.flywheelScore,
      score_breakdown: parsed.scoreBreakdown,
      wave_count: parsed.waveCount,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    await sb.from('plans').update(updatedFields).eq('id', id)

    // 7. Emit event
    await sb.from('war_room_events').insert({
      event_type: 'plan_iterated',
      agent_id: 'system',
      title: `Plan iterated: ${parsed.title || plan.title}`,
      description: `${result.mode} mode. ${parsed.beads.length} beads, ${parsed.waveCount} waves.`,
      metadata: { plan_id: id, mode: result.mode, feedback_length: feedback.length },
    })

    // 8. Vault sync (fire and forget)
    syncPlanToVault({ ...plan, ...updatedFields } as typeof plan).catch(() => {})

    // 9. Chain analysis if score warrants it
    if (newStatus === 'analyzing') {
      const { analyzePlan } = await import('@/lib/plan-analyzer')
      analyzePlan(parsed.title || plan.title, result.markdown, parsed.beads, parsed.flywheelScore)
        .then(async (analysis) => {
          await sb.from('plans').update({
            analysis,
            status: 'reviewing',
            updated_at: new Date().toISOString(),
          }).eq('id', id)
        })
        .catch((err) => captureError(err, 'plans/[id]/iterate.analyze', { planId: id }))
    }

    return NextResponse.json({
      success: true,
      mode: result.mode,
      beadCount: parsed.beads.length,
      waveCount: parsed.waveCount,
      status: newStatus,
    })
  } catch (err) {
    captureError(err, 'plans/[id]/iterate.POST')
    return NextResponse.json({ error: 'Iterate failed' }, { status: 500 })
  }
}
