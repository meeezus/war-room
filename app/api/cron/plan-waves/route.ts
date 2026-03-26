/**
 * Wave Advancement Cron — checks running plans and advances waves.
 *
 * When all missions in the current wave reach a terminal status
 * (completed, failed, deployed), the next wave's missions + tasks
 * are created automatically. When no more waves remain, the plan
 * is marked completed (or failed if any mission failed).
 *
 * Call via Vercel cron or Shogunate poller every ~60s.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type { ParsedBead } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 15

const log = logger('cron/plan-waves')

const TERMINAL_STATUSES = ['completed', 'failed', 'deployed']

const DOMAIN_TO_DAIMYO: Record<string, string> = {
  engineering: 'ed',
  strategy: 'light',
  operations: 'major',
  product: 'bulma',
  commerce: 'nanami',
}

function resolveModel(shortName?: string): string {
  if (shortName === 'opus') return 'claude-opus-4-6'
  if (shortName === 'haiku') return 'claude-haiku-4-5-20251001'
  return 'claude-sonnet-4-6'
}

function resolveTimeout(size: string): number {
  if (size === 'S') return 15
  if (size === 'L') return 60
  return 30
}

export async function GET() {
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  try {
    // 1. Get all running plans
    const { data: plans, error } = await sb
      .from('plans')
      .select('id, title, parsed_beads, wave_count, status')
      .eq('status', 'running')

    if (error || !plans?.length) {
      return NextResponse.json({ advanced: 0, completed: 0, message: 'No running plans' })
    }

    let advanced = 0
    let completed = 0

    for (const plan of plans) {
      const beads: ParsedBead[] = plan.parsed_beads || []

      // 2. Get all missions for this plan
      const { data: missions } = await sb
        .from('missions')
        .select('id, status, wave_index')
        .eq('plan_id', plan.id)

      if (!missions) continue

      // 3. Find the current wave (highest wave_index with missions)
      const missionWaves = [...new Set(missions.map((m: { wave_index: number }) => m.wave_index))].sort((a, b) => a - b)
      const currentWave = missionWaves.length ? Math.max(...missionWaves) : -1

      // 4. Check if current wave is complete (all missions terminal)
      const currentWaveMissions = missions.filter((m: { wave_index: number }) => m.wave_index === currentWave)
      const allTerminal = currentWaveMissions.every((m: { status: string }) =>
        TERMINAL_STATUSES.includes(m.status)
      )

      if (!allTerminal) continue // Wave still in progress

      // 5. Determine next wave
      const nextWave = currentWave + 1
      const nextWaveBeads = beads.filter(b => b.wave_index === nextWave)

      if (nextWaveBeads.length === 0) {
        // No more waves — plan is complete
        const anyFailed = missions.some((m: { status: string }) => m.status === 'failed')
        const finalStatus = anyFailed ? 'failed' : 'completed'

        await sb.from('plans').update({
          status: finalStatus,
          updated_at: new Date().toISOString(),
        }).eq('id', plan.id)

        await sb.from('war_room_events').insert({
          event_type: finalStatus === 'completed' ? 'plan_completed' : 'plan_failed',
          agent_id: 'system',
          title: `Plan ${finalStatus}: ${plan.title}`,
          description: `All ${plan.wave_count} waves finished. ${missions.filter((m: { status: string }) => m.status === 'completed').length}/${missions.length} missions succeeded.`,
          metadata: { plan_id: plan.id, total_missions: missions.length },
        })

        log.info(`Plan ${finalStatus}`, { planId: plan.id, title: plan.title })
        completed++
        continue
      }

      // 6. Create missions + tasks for next wave
      for (const bead of nextWaveBeads) {
        const daimyo = DOMAIN_TO_DAIMYO[bead.domain] || 'ed'
        const timeoutMinutes = resolveTimeout(bead.size)
        const model = resolveModel(bead.model)

        const { data: mission } = await sb.from('missions').insert({
          plan_id: plan.id,
          title: `${bead.id}: ${bead.title}`,
          assigned_to: daimyo,
          status: 'queued',
          wave_index: nextWave,
        }).select('id').single()

        if (!mission) continue

        const taskDesc = [
          bead.description,
          bead.accept.length ? `\n\nAcceptance:\n${bead.accept.map(a => `- ${a}`).join('\n')}` : '',
          bead.files.length ? `\n\nFiles:\n${bead.files.map(f => `- ${f}`).join('\n')}` : '',
        ].join('')

        await sb.from('tasks').insert({
          mission_id: mission.id,
          title: bead.title,
          description: taskDesc,
          kind: 'implementation',
          daimyo,
          owner: daimyo,
          model,
          status: 'queued',
          timeout_minutes: timeoutMinutes,
          working_dir: bead.repo ? `~/Code/${bead.repo}` : null,
        })
      }

      await sb.from('war_room_events').insert({
        event_type: 'plan_wave_completed',
        agent_id: 'system',
        title: `Wave ${currentWave} complete — advancing to wave ${nextWave}`,
        description: `${nextWaveBeads.length} beads queued for wave ${nextWave}.`,
        metadata: { plan_id: plan.id, completed_wave: currentWave, next_wave: nextWave },
      })

      log.info('Wave advanced', {
        planId: plan.id,
        completedWave: currentWave,
        nextWave,
        beadCount: nextWaveBeads.length,
      })
      advanced++
    }

    return NextResponse.json({ advanced, completed, plansChecked: plans.length })
  } catch (err) {
    log.error('Wave check failed', err)
    return NextResponse.json({ error: 'Wave check failed' }, { status: 500 })
  }
}
