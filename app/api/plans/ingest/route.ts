import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { parsePlanMarkdown } from '@/lib/plan-parser'
import { captureError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { markdown, auto_run } = body

    if (!markdown || typeof markdown !== 'string') {
      return NextResponse.json(
        { error: 'markdown field required' },
        { status: 400 }
      )
    }

    // Step 0: Adaptive detection -- check structure level
    const hasBeads = /###?\s+BEAD-\d+/i.test(markdown)
    const isOneLiner = markdown.trim().length < 200 && !markdown.includes('\n')

    let structureLevel: 'structured' | 'rough' | 'one-liner'
    if (hasBeads) structureLevel = 'structured'
    else if (isOneLiner) structureLevel = 'one-liner'
    else structureLevel = 'rough'

    // Step 1: Parse
    const parsed = parsePlanMarkdown(markdown)

    // Step 2: Determine initial status
    const needsBrainstorm = structureLevel !== 'structured'
    const initialStatus = needsBrainstorm
      ? 'brainstorming'
      : parsed.flywheelScore <= 4
        ? 'reviewing'
        : 'analyzing'

    const sb = createServiceClient()
    if (!sb) {
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 500 }
      )
    }

    const { data, error } = await sb
      .from('plans')
      .insert({
        title: parsed.title || 'Untitled Plan',
        raw_markdown: markdown,
        parsed_beads: parsed.beads,
        status: initialStatus,
        flywheel_score: parsed.flywheelScore,
        score_breakdown: parsed.scoreBreakdown,
        auto_run: auto_run || false,
        wave_count: parsed.waveCount,
      })
      .select()
      .single()

    if (error) {
      captureError(error, 'plans.ingest')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Emit event
    await sb.from('war_room_events').insert({
      event_type: 'plan_ingested',
      agent_id: 'system',
      title: `Plan ingested: ${parsed.title}`,
      description: `${parsed.beads.length} beads, ${parsed.waveCount} waves, score ${parsed.flywheelScore}. Structure: ${structureLevel}`,
      metadata: {
        plan_id: data.id,
        structure_level: structureLevel,
        flywheel_score: parsed.flywheelScore,
      },
    })

    return NextResponse.json(
      {
        plan: data,
        structureLevel,
        needsBrainstorm,
        waves: parsed.waves,
        beadCount: parsed.beads.length,
      },
      { status: 201 }
    )
  } catch (err) {
    captureError(err, 'plans.ingest')
    return NextResponse.json(
      { error: 'Failed to ingest plan' },
      { status: 500 }
    )
  }
}
