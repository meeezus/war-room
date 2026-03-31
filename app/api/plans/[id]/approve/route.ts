import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { captureError } from '@/lib/sentry'
import { syncPlanToVault } from '@/lib/vault-sync'
import type { ParsedBead } from '@/lib/types'

export const dynamic = 'force-dynamic'

const DOMAIN_TO_DAIMYO: Record<string, string> = {
  engineering: 'ed',
  strategy: 'light',
  operations: 'major',
  product: 'bulma',
  commerce: 'nanami',
}

const SIZE_TO_TIMEOUT: Record<string, number> = {
  S: 15,
  M: 30,
  L: 60,
}

const SIZE_TO_MODEL: Record<string, string> = {
  S: 'claude-haiku-4-5-20251001',
  M: 'claude-sonnet-4-6',
  L: 'claude-sonnet-4-6',
}

function resolveModel(bead: ParsedBead): string {
  if (bead.model === 'opus') return 'claude-opus-4-6'
  if (bead.model === 'haiku') return 'claude-haiku-4-5-20251001'
  if (bead.model === 'sonnet') return 'claude-sonnet-4-6'
  return SIZE_TO_MODEL[bead.size] || 'claude-sonnet-4-6'
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 500 }
    )
  }

  try {
    // 1. Fetch the plan
    const { data: plan, error: fetchErr } = await sb
      .from('plans')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    if (!['reviewing', 'approved'].includes(plan.status)) {
      return NextResponse.json(
        { error: `Cannot approve plan in '${plan.status}' status` },
        { status: 400 }
      )
    }

    const beads: ParsedBead[] = plan.parsed_beads || []
    if (beads.length === 0) {
      return NextResponse.json(
        { error: 'Plan has no beads' },
        { status: 400 }
      )
    }

    // 2. Update plan status to 'running'
    await sb
      .from('plans')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', id)

    // 3. Create missions + tasks for wave 0 only
    const wave0Beads = beads.filter((b) => b.wave_index === 0)
    const missionIds: string[] = []

    for (const bead of wave0Beads) {
      const daimyo = DOMAIN_TO_DAIMYO[bead.domain] || 'ed'
      const timeoutMinutes = SIZE_TO_TIMEOUT[bead.size] || 30
      const model = resolveModel(bead)

      // Create mission
      const { data: mission, error: missionErr } = await sb
        .from('missions')
        .insert({
          plan_id: id,
          title: `${bead.id}: ${bead.title}`,
          assigned_to: daimyo,
          status: 'queued',
          wave_index: bead.wave_index,
        })
        .select('id')
        .single()

      if (missionErr || !mission) {
        console.error(`Failed to create mission for ${bead.id}:`, missionErr)
        continue
      }

      missionIds.push(mission.id)

      // Assemble task description
      const taskDescription = [
        bead.description,
        bead.accept.length
          ? `\n\nAcceptance criteria:\n${bead.accept.map((a) => `- ${a}`).join('\n')}`
          : '',
        bead.files.length
          ? `\n\nFiles:\n${bead.files.map((f) => `- ${f}`).join('\n')}`
          : '',
      ].join('')

      // Create task
      const { error: taskErr } = await sb.from('tasks').insert({
        mission_id: mission.id,
        title: bead.title,
        description: taskDescription,
        kind: 'code',
        daimyo,
        owner: daimyo,
        model,
        status: 'queued',
        timeout_minutes: timeoutMinutes,
        working_dir: bead.repo ? `~/Code/${bead.repo}` : null,
      })

      if (taskErr) {
        console.error(`Failed to create task for mission ${mission.id} (bead ${bead.id}):`, taskErr)
      }
    }

    // 4. Emit plan_approved event
    await sb.from('war_room_events').insert({
      event_type: 'plan_approved',
      agent_id: 'system',
      title: `Plan approved: ${plan.title}`,
      description: `Wave 0 started — ${wave0Beads.length} beads queued. ${beads.length} total beads across ${plan.wave_count} waves.`,
      metadata: {
        plan_id: id,
        wave: 0,
        mission_ids: missionIds,
        bead_count: beads.length,
      },
    })

    // 5. Sync to vault (fire and forget)
    syncPlanToVault({ ...plan, status: 'running' }).catch(() => {})

    return NextResponse.json({
      success: true,
      planId: id,
      wave: 0,
      missionsCreated: missionIds.length,
      totalBeads: beads.length,
      totalWaves: plan.wave_count,
    })
  } catch (err) {
    captureError(err, 'plan-approve', { planId: id })
    return NextResponse.json(
      { error: 'Failed to approve plan' },
      { status: 500 }
    )
  }
}
