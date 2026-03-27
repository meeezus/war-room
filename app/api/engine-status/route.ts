import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json(defaultStatus(), { status: 200 })
  }

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    // All queries in parallel
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTodayIso = startOfToday.toISOString()

    const [heartbeatRes, failedRes, winsRes, objectivesRes, objectiveMissionsRes, autoApprovedRes, pendingRes, dailyCostRes, capGateRes] = await Promise.all([
      // Latest heartbeat
      sb.from('war_room_events')
        .select('metadata, created_at')
        .eq('event_type', 'heartbeat')
        .order('created_at', { ascending: false })
        .limit(5),
      // Failed missions (24h) — capped at 100 for display
      sb.from('missions')
        .select('id, title, assigned_to, evaluation_result')
        .eq('status', 'failed')
        .gte('completed_at', twentyFourHoursAgo)
        .order('completed_at', { ascending: false })
        .limit(100),
      // Completed missions (24h) — capped at 100 for display
      sb.from('missions')
        .select('id, title, assigned_to')
        .eq('status', 'completed')
        .gte('completed_at', twentyFourHoursAgo)
        .order('completed_at', { ascending: false })
        .limit(100),
      // Active objectives — capped at 200 (plan: 50, increased for headroom)
      sb.from('objectives')
        .select('id, title')
        .eq('status', 'active')
        .limit(200),
      // Missions with objective_id (48h, stalled detection) — capped at 1000 (plan: 500, doubled for burst capacity)
      sb.from('missions')
        .select('objective_id, created_at')
        .not('objective_id', 'is', null)
        .gte('created_at', fortyEightHoursAgo)
        .limit(1000),
      // Auto-approved proposals (24h) — capped at 50 for display
      sb.from('proposals')
        .select('id, title')
        .eq('approved_by', 'system')
        .gte('approved_at', twentyFourHoursAgo)
        .order('approved_at', { ascending: false })
        .limit(50),
      // Pending proposals count
      sb.from('proposals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      // Daily mission spend — capped at 5000 rows for client-side SUM (plan: 1000, increased for headroom)
      // NOTE: At 5000+ missions/day, migrate to Postgres RPC aggregate to avoid memory bloat
      sb.from('missions')
        .select('cost_estimate')
        .gte('completed_at', startOfTodayIso)
        .limit(5000),
      // Budget cap from cap_gates (global gate)
      sb.from('cap_gates')
        .select('daily_budget_usd')
        .eq('name', 'global')
        .eq('is_active', true)
        .single(),
    ])

    // Compute health from heartbeats
    const heartbeats = heartbeatRes.data ?? []
    let health: 'nominal' | 'degraded' | 'down' = 'down'
    let avgCycleMs: number | null = null

    const recentHeartbeat = heartbeats.find(h => h.created_at >= thirtyMinAgo)
    if (recentHeartbeat) {
      const cycleTimes = heartbeats
        .map(h => (h.metadata as Record<string, unknown>)?.cycle_duration_ms as number | undefined)
        .filter((v): v is number => typeof v === 'number')
      avgCycleMs = cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) : null
      if (avgCycleMs !== null && avgCycleMs <= 30000) health = 'nominal'
      else if (avgCycleMs !== null && avgCycleMs <= 120000) health = 'degraded'
      else health = 'degraded'
    }

    // Extract authority from latest heartbeat
    const latestMeta = heartbeats[0]?.metadata as Record<string, unknown> | undefined
    const authRaw = latestMeta?.authority_summary as Record<string, unknown> | undefined
    const authority = authRaw ? {
      enabled: (authRaw.enabled as boolean) ?? false,
      threshold: (authRaw.threshold as number) ?? 0,
      domains: (authRaw.domains as Record<string, { tier: string; totalMissions: number; successful: number; successRate: number }>) ?? {},
    } : { enabled: false, threshold: 0, domains: {} }

    // Failures with root cause
    const failures = (failedRes.data ?? []).map((m: Record<string, unknown>) => {
      const evalResult = m.evaluation_result as Record<string, unknown> | null
      return {
        id: m.id as string,
        title: m.title as string,
        agent: m.assigned_to as string,
        rootCause: (evalResult?.root_cause as string) ?? null,
        fixApproach: (evalResult?.fix_approach as string) ?? null,
      }
    })

    // Wins
    const wins = (winsRes.data ?? []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      title: m.title as string,
      agent: m.assigned_to as string,
    }))

    // Stalled objectives — active objectives with no mission in 48h
    const objectivesWithRecentMissions = new Set(
      (objectiveMissionsRes.data ?? []).map((m: Record<string, unknown>) => m.objective_id as string)
    )
    const stalledObjectives = (objectivesRes.data ?? [])
      .filter((o: Record<string, unknown>) => !objectivesWithRecentMissions.has(o.id as string))
      .map((o: Record<string, unknown>) => ({ id: o.id as string, title: o.title as string }))

    // Auto-approved
    const autoApproved = (autoApprovedRes.data ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      title: p.title as string,
    }))

    // Compute real budgetOk from daily mission spend vs cap_gates
    const dailySpendUsd = (dailyCostRes.data ?? [])
      .reduce((sum: number, m: Record<string, unknown>) => sum + (((m.cost_estimate as number) ?? 0)), 0)
    const dailyBudgetUsd: number | null =
      (capGateRes.data as Record<string, unknown> | null)?.daily_budget_usd as number ?? null
    const budgetOk = dailyBudgetUsd === null ? true : dailySpendUsd < dailyBudgetUsd

    return NextResponse.json({
      health,
      avgCycleMs,
      budgetOk,
      failures,
      wins,
      stalledObjectives,
      autoApproved,
      pendingProposals: pendingRes.count ?? 0,
      authority,
    })
  } catch (err) {
    console.error('engine-status error:', err)
    return NextResponse.json(defaultStatus(), { status: 200 })
  }
}

function defaultStatus() {
  return {
    health: 'down' as const,
    avgCycleMs: null,
    budgetOk: true,
    failures: [],
    wins: [],
    stalledObjectives: [],
    autoApproved: [],
    pendingProposals: 0,
    authority: { enabled: false, threshold: 0, domains: {} },
  }
}
