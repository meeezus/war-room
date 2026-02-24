import { createServiceClient } from '@/lib/supabase-server'
import type { Project, Mission, Task, Event } from '@/lib/types'

// ---------------------------------------------------------------------------
// Relative time helper (no deps)
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  if (diffMs < 0) return 'just now'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

// ---------------------------------------------------------------------------
// buildPulseContext
// ---------------------------------------------------------------------------

export async function buildPulseContext(): Promise<string> {
  const sb = createServiceClient()
  if (!sb) return '## Shogunate Pulse\n\n_Engine offline — no Supabase connection._'

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [
      projectsRes,
      missionsRes,
      eventsRes,
      staleTasksRes,
      failedMissionsRes,
      failedTasksRes,
      agentCountRes,
      pendingProposalsRes,
    ] = await Promise.all([
      // Active projects
      sb.from('projects')
        .select('*')
        .in('status', ['inprogress', 'queue'])
        .order('priority', { ascending: true })
        .limit(5),

      // Running/queued missions
      sb.from('missions')
        .select('*')
        .in('status', ['queued', 'running'])
        .order('priority', { ascending: true })
        .limit(5),

      // Recent events (exclude heartbeat)
      sb.from('events')
        .select('*')
        .neq('type', 'heartbeat')
        .order('created_at', { ascending: false })
        .limit(10),

      // Stale tasks (no update in 7+ days, still active)
      sb.from('tasks')
        .select('*')
        .in('status', ['in_progress', 'assigned', 'todo'])
        .lt('updated_at', sevenDaysAgo)
        .limit(5),

      // Failed missions in last 24h
      sb.from('missions')
        .select('*')
        .eq('status', 'failed')
        .gte('created_at', twentyFourHoursAgo)
        .limit(5),

      // Failed tasks in last 24h
      sb.from('tasks')
        .select('*')
        .eq('status', 'failed')
        .gte('updated_at', twentyFourHoursAgo)
        .limit(5),

      // Active/busy agent count
      sb.from('agent_status')
        .select('id', { count: 'exact', head: true })
        .in('status', ['online', 'busy']),

      // Pending proposals count
      sb.from('proposals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])

    // Log errors but don't throw
    if (projectsRes.error) console.error('[pulse] projects query error:', projectsRes.error)
    if (missionsRes.error) console.error('[pulse] missions query error:', missionsRes.error)
    if (eventsRes.error) console.error('[pulse] events query error:', eventsRes.error)
    if (staleTasksRes.error) console.error('[pulse] stale tasks query error:', staleTasksRes.error)
    if (failedMissionsRes.error) console.error('[pulse] failed missions query error:', failedMissionsRes.error)
    if (failedTasksRes.error) console.error('[pulse] failed tasks query error:', failedTasksRes.error)
    if (agentCountRes.error) console.error('[pulse] agent count query error:', agentCountRes.error)
    if (pendingProposalsRes.error) console.error('[pulse] pending proposals query error:', pendingProposalsRes.error)

    const projects = (projectsRes.data ?? []) as Project[]
    const missions = (missionsRes.data ?? []) as Mission[]
    const events = (eventsRes.data ?? []) as Event[]
    const staleTasks = (staleTasksRes.data ?? []) as Task[]
    const failedMissions = (failedMissionsRes.data ?? []) as Mission[]
    const failedTasks = (failedTasksRes.data ?? []) as Task[]
    const activeAgentCount = agentCountRes.count ?? 0
    const pendingProposalCount = pendingProposalsRes.count ?? 0

    // ----- Build markdown -----
    const lines: string[] = ['## Shogunate Pulse — Live Engine State', '']

    // Active Projects
    lines.push('### Active Projects')
    if (projects.length === 0) {
      lines.push('_None._')
    } else {
      for (const p of projects) {
        const due = p.target_date ? ` — due ${p.target_date}` : ''
        const prio = `P${p.priority}`
        lines.push(`- ${p.title} (${prio}, ${p.status})${due}`)
      }
    }
    lines.push('')

    // Running Missions
    lines.push('### Running Missions')
    if (missions.length === 0) {
      lines.push('_None._')
    } else {
      for (const m of missions) {
        const since = m.started_at ? ` — ${m.status} since ${timeAgo(m.started_at)}` : ` — ${m.status}`
        lines.push(`- "${m.title}" assigned to ${m.assigned_to}${since}`)
      }
    }
    lines.push('')

    // Needs Attention
    const needsAttention: string[] = []
    if (staleTasks.length > 0) {
      needsAttention.push(`- ${staleTasks.length} stale task${staleTasks.length > 1 ? 's' : ''} (no activity 7+ days)`)
      for (const t of staleTasks) {
        needsAttention.push(`  - "${t.title}" — last update ${timeAgo(t.updated_at)}`)
      }
    }
    if (failedMissions.length > 0) {
      for (const m of failedMissions) {
        needsAttention.push(`- Failed mission: "${m.title}" (${timeAgo(m.created_at)})`)
      }
    }
    if (failedTasks.length > 0) {
      for (const t of failedTasks) {
        needsAttention.push(`- Failed task: "${t.title}" (${timeAgo(t.updated_at)})`)
      }
    }
    if (needsAttention.length > 0) {
      lines.push('### Needs Attention')
      lines.push(...needsAttention)
      lines.push('')
    }

    // Recent Events
    lines.push('### Recent Events (last 10)')
    if (events.length === 0) {
      lines.push('_None._')
    } else {
      for (const e of events) {
        const agent = e.agent ? ` ${e.agent}` : ''
        lines.push(`- [${e.type}]${agent} ${e.message} — ${timeAgo(e.created_at)}`)
      }
    }
    lines.push('')

    // Stats
    lines.push('### Stats')
    lines.push(`- ${activeAgentCount} active agent${activeAgentCount !== 1 ? 's' : ''}, ${pendingProposalCount} pending proposal${pendingProposalCount !== 1 ? 's' : ''}`)
    lines.push('')

    // Available Actions
    lines.push('### Available Actions')
    lines.push('You can take actions by including structured blocks in your response:')
    lines.push('')
    lines.push('```')
    lines.push('[ACTION]')
    lines.push('{"type": "create_mission", "title": "...", "project_id": "...", "assigned_to": "..."}')
    lines.push('[/ACTION]')
    lines.push('```')
    lines.push('')
    lines.push('**Valid action types:**')
    lines.push('- `create_mission` — Create a new mission. Fields: title (required), project_id (optional), assigned_to (optional, defaults to you)')
    lines.push('- `create_proposal` — Create a proposal for review. Fields: title (required), description (optional), domain (optional)')
    lines.push('- `update_task` — Update a task status. Fields: task_id (required, number), status (required: todo/assigned/in_progress/review/done/blocked/failed)')
    lines.push('- `update_project` — Update project status/priority. Fields: project_id (required), status (optional: inprogress/queue/done/onhold), priority (optional, number)')
    lines.push('- `flag_attention` — Flag something for Sensei. Fields: message (required)')
    lines.push('')
    lines.push('**When to use:** Only when Sensei explicitly requests or when intent is clear. Do NOT use speculatively.')

    return lines.join('\n')
  } catch (err) {
    console.error('[pulse] buildPulseContext error:', err)
    return '## Shogunate Pulse\n\n_Error fetching engine state. Check server logs._'
  }
}
