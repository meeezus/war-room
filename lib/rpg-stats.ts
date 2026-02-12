import { supabase } from '@/lib/supabase'
import type { RpgStats } from '@/lib/types'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Compute RPG stats for an agent from real Supabase data.
 * Falls back to baseline stats if no data available.
 */
export async function getRpgStats(agentId: string): Promise<RpgStats> {
  if (!supabase) return baselineStats()

  // Fetch all needed data in parallel
  const [completedRes, failedRes, stepsRes, eventsRes, missionsCountRes] = await Promise.all([
    supabase.from('missions').select('id', { count: 'exact', head: true })
      .eq('assigned_to', agentId).eq('status', 'completed'),
    supabase.from('missions').select('id', { count: 'exact', head: true })
      .eq('assigned_to', agentId).eq('status', 'failed'),
    supabase.from('steps').select('started_at, completed_at')
      .eq('daimyo', agentId).eq('status', 'completed')
      .not('started_at', 'is', null).not('completed_at', 'is', null),
    supabase.from('events').select('id', { count: 'exact', head: true })
      .eq('agent', agentId),
    supabase.from('missions').select('id', { count: 'exact', head: true })
      .eq('assigned_to', agentId),
  ])

  const completed = completedRes.count ?? 0
  const failed = failedRes.count ?? 0
  const eventCount = eventsRes.count ?? 0
  const totalMissions = missionsCountRes.count ?? 0

  // TRU — success rate
  const totalFinished = completed + failed
  const successRate = totalFinished > 0 ? completed / totalFinished : 0.5
  const TRU = clamp(Math.round(successRate * 99), 0, 99)

  // SPD — avg completion time
  const steps = stepsRes.data ?? []
  let avgHours = 12 // default
  if (steps.length > 0) {
    const totalHours = steps.reduce((sum, s) => {
      const start = new Date(s.started_at).getTime()
      const end = new Date(s.completed_at).getTime()
      return sum + (end - start) / (1000 * 60 * 60)
    }, 0)
    avgHours = totalHours / steps.length
  }
  const SPD = clamp(Math.round(99 - (avgHours / 24) * 99), 0, 99)

  // WIS — experience (events + missions)
  const wisCount = Math.max(eventCount + totalMissions, 1)
  const WIS = clamp(Math.round(Math.log10(wisCount) / Math.log10(200) * 99), 0, 99)

  // PWR — missions completed
  const PWR = clamp(Math.round(Math.min(completed / 20, 1) * 99), 0, 99)

  const level = Math.floor((TRU + SPD + WIS + PWR) / 40) + 1
  const totalXP = TRU + SPD + WIS + PWR

  return { TRU, SPD, WIS, PWR, level, totalXP }
}

function baselineStats(): RpgStats {
  return { TRU: 50, SPD: 50, WIS: 10, PWR: 0, level: 3, totalXP: 110 }
}

/**
 * Get baseline stats synchronously (for fallback scenarios).
 */
export function getBaselineStats(): RpgStats {
  return baselineStats()
}
