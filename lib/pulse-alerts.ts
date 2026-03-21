import { createServiceClient } from '@/lib/supabase-server'
import { captureError } from '@/lib/sentry'
import type { Mission, Task, Project, Discovery } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PulseAlert = {
  severity: 'critical' | 'warning' | 'info'
  message: string
}

// ---------------------------------------------------------------------------
// generateAlerts — check engine state for things that need attention
// ---------------------------------------------------------------------------

export async function generateAlerts(): Promise<PulseAlert[]> {
  const sb = createServiceClient()
  if (!sb) return []

  try {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [failedMissionsRes, failedTasksRes, staleTasksRes, projectsRes, recentActivityRes, pendingDiscoveriesRes, costFailuresRes] = await Promise.all([
      // Failed missions in last 24h
      sb.from('missions')
        .select('id, title, assigned_to')
        .eq('status', 'failed')
        .gte('created_at', oneDayAgo)
        .limit(5),
      // Failed tasks in last 24h
      sb.from('tasks')
        .select('id, title, project_id')
        .eq('status', 'failed')
        .gte('updated_at', oneDayAgo)
        .limit(5),
      // Stale tasks (7+ days no activity, not done/someday)
      sb.from('tasks')
        .select('id, title, project_id')
        .in('status', ['in_progress', 'assigned', 'todo'])
        .lte('updated_at', sevenDaysAgo)
        .limit(10),
      // All active projects (check for approaching deadlines, P0 stalls)
      sb.from('projects')
        .select('id, title, status, priority, target_date')
        .in('status', ['inprogress', 'queue']),
      // Any activity in last 24h (to detect silence)
      sb.from('war_room_events')
        .select('id', { count: 'exact', head: true })
        .neq('event_type', 'heartbeat')
        .gte('created_at', oneDayAgo),
      // Pending discoveries
      sb.from('discoveries')
        .select('id, severity', { count: 'exact' })
        .eq('status', 'pending'),
      // Embedding cost tracking failures in last 24h
      sb.from('war_room_events')
        .select('id, metadata', { count: 'exact' })
        .eq('event_type', 'cost_tracking_failure')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    const failedMissions = (failedMissionsRes.data ?? []) as Pick<Mission, 'id' | 'title' | 'assigned_to'>[]
    const failedTasks = (failedTasksRes.data ?? []) as Pick<Task, 'id' | 'title' | 'project_id'>[]
    const staleTasks = (staleTasksRes.data ?? []) as Pick<Task, 'id' | 'title' | 'project_id'>[]
    const projects = (projectsRes.data ?? []) as Project[]
    const recentActivityCount = recentActivityRes.count ?? 0
    const pendingDiscoveries = (pendingDiscoveriesRes.data ?? []) as Pick<Discovery, 'id' | 'severity'>[]
    const costFailureCount = costFailuresRes.count ?? 0
    const latestCostFailure = (costFailuresRes.data ?? [])[0]?.metadata as Record<string, unknown> | undefined

    const alerts: PulseAlert[] = []

    // Failed missions — critical
    if (failedMissions.length > 0) {
      const names = failedMissions.map(m => `"${m.title}"`).join(', ')
      alerts.push({
        severity: 'critical',
        message: `${failedMissions.length} mission${failedMissions.length > 1 ? 's' : ''} failed in the last 24h: ${names}`,
      })
    }

    // Failed tasks — critical
    if (failedTasks.length > 0) {
      alerts.push({
        severity: 'critical',
        message: `${failedTasks.length} task${failedTasks.length > 1 ? 's' : ''} failed in the last 24h`,
      })
    }

    // Approaching deadlines — warning
    for (const project of projects) {
      if (project.target_date && project.target_date <= threeDaysFromNow && project.target_date >= now.toISOString()) {
        const daysLeft = Math.ceil((new Date(project.target_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        alerts.push({
          severity: 'warning',
          message: `"${project.title}" deadline in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
        })
      }
    }

    // P0 projects with no active tasks — warning
    if (projects.length > 0) {
      // Fetch active task counts per project
      const p0Projects = projects.filter(p => p.priority === 0 && p.status === 'inprogress')
      if (p0Projects.length > 0) {
        const activeTasksRes = await sb
          .from('tasks')
          .select('project_id')
          .in('project_id', p0Projects.map(p => p.id))
          .in('status', ['in_progress', 'assigned', 'todo', 'review'])

        const activeByProject = new Set((activeTasksRes.data ?? []).map((t: { project_id: string }) => t.project_id))
        for (const p of p0Projects) {
          if (!activeByProject.has(p.id)) {
            alerts.push({
              severity: 'warning',
              message: `P0 project "${p.title}" has no active tasks — stalled?`,
            })
          }
        }
      }
    }

    // Stale tasks — warning
    if (staleTasks.length > 0) {
      alerts.push({
        severity: 'warning',
        message: `${staleTasks.length} task${staleTasks.length > 1 ? 's' : ''} with no activity for 7+ days`,
      })
    }

    // Pending discoveries — info (or warning if critical ones)
    if (pendingDiscoveries.length > 0) {
      const criticalCount = pendingDiscoveries.filter(d => d.severity === 'critical').length
      alerts.push({
        severity: criticalCount > 0 ? 'warning' : 'info',
        message: `${pendingDiscoveries.length} overnight discover${pendingDiscoveries.length === 1 ? 'y' : 'ies'} awaiting your review${criticalCount > 0 ? ` (${criticalCount} critical)` : ''}`,
      })
    }

    // Complete silence — info
    if (recentActivityCount === 0) {
      alerts.push({
        severity: 'info',
        message: 'No engine activity in the last 24 hours — everything quiet',
      })
    }

    // Embedding cost tracking failures — warning
    if (costFailureCount > 0) {
      const totalFailures = (latestCostFailure?.total_failures as number) ?? costFailureCount
      alerts.push({
        severity: 'warning',
        message: `Embedding cost tracking: ${totalFailures} DB write failure${totalFailures !== 1 ? 's' : ''} since startup — spending may be underreported`,
      })
    }

    return alerts
  } catch (err) {
    captureError(err, 'pulse.generateAlerts')
    return []
  }
}
