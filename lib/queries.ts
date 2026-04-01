import { supabase } from '@/lib/supabase'
import type { AgentStatus, Mission, Step, Event, DashboardStats, Project, ProjectWithMetrics, Board, Task, DynastyStats, Proposal, CouncilSession, ActiveAgent, Discovery, Objective, ObjectiveWithMetrics, ActiveWorker, OutcomeCard, ResearchFinding, Plan } from '@/lib/types'

// Domain → Daimyo routing (matches engine/config.py DOMAIN_TO_DAIMYO)
export const DOMAIN_TO_DAIMYO: Record<string, string> = {
  engineering: 'ed',
  product: 'light',
  commerce: 'toji',
  influence: 'makima',
  operations: 'major',
  coordination: 'cc',
}

export async function getAgents(): Promise<AgentStatus[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('agent_status')
    .select('*')
  if (error) { console.error('getAgents error:', error); return [] }
  return data as AgentStatus[]
}

export async function getMissions(status?: string): Promise<Mission[]> {
  if (!supabase) return []
  let query = supabase
    .from('missions')
    .select('*')
    .not('status', 'eq', 'archived')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
  if (status) {
    query = query.eq('status', status)
  }
  const { data, error } = await query
  if (error) { console.error('getMissions error:', error); return [] }
  return data as Mission[]
}

export async function getMissionWithTasks(id: string): Promise<{ mission: Mission | null; tasks: Task[] }> {
  if (!supabase) return { mission: null, tasks: [] }

  const [missionRes, tasksRes] = await Promise.all([
    supabase.from('missions').select('*').eq('id', id).single(),
    supabase.from('tasks').select('*').eq('mission_id', id).order('created_at', { ascending: true }),
  ])

  if (missionRes.error) { console.error('getMissionWithTasks mission error:', missionRes.error) }
  if (tasksRes.error) { console.error('getMissionWithTasks tasks error:', tasksRes.error) }

  return {
    mission: (missionRes.data as Mission) ?? null,
    tasks: (tasksRes.data as Task[]) ?? [],
  }
}

/** @deprecated Use getMissionWithTasks instead */
export const getMissionWithSteps = getMissionWithTasks

export async function getMissionTasks(missionId: string): Promise<Task[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('mission_id', missionId)
    .order('created_at', { ascending: true })
  if (error) { console.error('getMissionTasks error:', error); return [] }
  return data as Task[]
}

export async function getEvents(limit = 50): Promise<Event[]> {
  if (!supabase) return []
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('war_room_events')
    .select('*')
    .neq('event_type', 'heartbeat')
    .gte('created_at', threeDaysAgo)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('getEvents error:', error); return [] }
  return data as Event[]
}

export async function getAgentWithHistory(id: string): Promise<{
  agent: AgentStatus | null
  missions: Mission[]
  events: Event[]
}> {
  if (!supabase) return { agent: null, missions: [], events: [] }

  const [agentRes, missionsRes, eventsRes] = await Promise.all([
    supabase.from('agent_status').select('*').eq('id', id).single(),
    supabase.from('missions').select('*').eq('assigned_to', id).order('created_at', { ascending: false }),
    supabase.from('war_room_events').select('*').eq('agent_id', id).order('created_at', { ascending: false }),
  ])

  if (agentRes.error) { console.error('getAgentWithHistory agent error:', agentRes.error) }
  if (missionsRes.error) { console.error('getAgentWithHistory missions error:', missionsRes.error) }
  if (eventsRes.error) { console.error('getAgentWithHistory events error:', eventsRes.error) }

  return {
    agent: (agentRes.data as AgentStatus) ?? null,
    missions: (missionsRes.data as Mission[]) ?? [],
    events: (eventsRes.data as Event[]) ?? [],
  }
}

export async function getStats(): Promise<DashboardStats> {
  const defaults: DashboardStats = { activeAgents: 0, inProgressTasks: 0, pendingReviews: 0, pendingProposals: 0 }
  if (!supabase) return defaults

  const [agentsRes, inProgressRes] = await Promise.all([
    supabase.from('agent_status').select('id', { count: 'exact', head: true }).in('status', ['online', 'busy']),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
  ])

  return {
    activeAgents: agentsRes.count ?? 0,
    inProgressTasks: inProgressRes.count ?? 0,
    pendingReviews: 0,
    pendingProposals: 0,
  }
}

// ---------------------------------------------------------------------------
// Dynasty-wide project queries
// ---------------------------------------------------------------------------

export async function getProjects(): Promise<Project[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('priority', { ascending: true })
  if (error) { console.error('getProjects error:', error); return [] }
  return data as Project[]
}

// Row shape returned by the PostgREST 12 aggregate query
type TaskStatusAggregate = {
  project_id: string | null
  status: string
  count: number
  max: string | null  // MAX(updated_at) aliased as "max" by PostgREST
}

export async function getProjectsWithMetrics(): Promise<ProjectWithMetrics[]> {
  if (!supabase) return []

  // Fetch projects, task status aggregates, and pending proposals in parallel.
  // The tasks query uses database-level COUNT + GROUP BY instead of loading every
  // task row and filtering client-side, which keeps memory usage proportional to
  // the number of distinct (project_id, status) pairs rather than total task count.
  const [projectsRes, taskMetricsRes, proposalsRes] = await Promise.all([
    supabase.from('projects').select('*').order('priority', { ascending: true }),
    supabase.from('tasks').select('project_id, status, count(), updated_at.max()'),
    supabase.from('proposals').select('id, project_id').eq('status', 'pending'),
  ])

  const projects = (projectsRes.data as Project[]) ?? []
  const taskMetrics = (taskMetricsRes.data ?? []) as unknown as TaskStatusAggregate[]
  const pendingProposals = (proposalsRes.data ?? []) as { id: string; project_id: string | null }[]

  const STATUS_ORDER: Record<string, number> = { inprogress: 0, queue: 1, onhold: 2, done: 3 }

  return projects.map(project => {
    const projectMetrics = taskMetrics.filter(m => m.project_id === project.id)

    // Build count map from aggregated rows — O(statuses) not O(tasks)
    const countByStatus: Record<string, number> = {}
    for (const m of projectMetrics) {
      countByStatus[m.status] = m.count
    }

    const taskCounts = {
      todo: countByStatus['todo'] ?? 0,
      assigned: countByStatus['assigned'] ?? 0,
      queued: countByStatus['queued'] ?? 0,
      in_progress: countByStatus['in_progress'] ?? 0,
      review: countByStatus['review'] ?? 0,
      done: countByStatus['done'] ?? 0,
      blocked: countByStatus['blocked'] ?? 0,
      failed: countByStatus['failed'] ?? 0,
      someday: countByStatus['someday'] ?? 0,
    }

    const totalTasks = Object.entries(countByStatus)
      .filter(([status]) => status !== 'someday')
      .reduce((sum, [, n]) => sum + n, 0)

    const activeTasks = taskCounts.todo + taskCounts.assigned + taskCounts.in_progress + taskCounts.review + taskCounts.blocked

    // MAX(updated_at) is returned per (project_id, status) row — take the latest across all statuses
    const lastActivity = projectMetrics.length > 0
      ? projectMetrics.reduce<string | null>((latest, m) => {
          if (!m.max) return latest
          if (!latest) return m.max
          return m.max > latest ? m.max : latest
        }, null)
      : null

    return {
      ...project,
      taskCounts,
      totalTasks,
      activeTasks,
      lastActivity,
      pendingProposals: pendingProposals.filter(p => p.project_id === project.id).length,
    }
  }).sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 99
    const sb = STATUS_ORDER[b.status] ?? 99
    if (sa !== sb) return sa - sb
    return a.priority - b.priority
  })
}

export async function getProjectWithBoards(id: string): Promise<{
  project: Project | null
  boards: (Board & { tasks: Task[] })[]
  allTasks: Task[]
}> {
  if (!supabase) return { project: null, boards: [], allTasks: [] }

  const [projectRes, boardsRes, tasksRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('boards').select('*').eq('project_id', id).order('created_at', { ascending: true }),
    supabase.from('tasks').select('*').eq('project_id', id).order('priority', { ascending: true }).order('created_at', { ascending: true }),
  ])

  if (projectRes.error) { console.error('getProjectWithBoards project error:', projectRes.error) }
  if (boardsRes.error) { console.error('getProjectWithBoards boards error:', boardsRes.error) }
  if (tasksRes.error) { console.error('getProjectWithBoards tasks error:', tasksRes.error) }

  const allTasks = (tasksRes.data as Task[]) ?? []
  const boardsWithTasks = ((boardsRes.data as Board[]) ?? []).map((board) => ({
    ...board,
    tasks: allTasks.filter((t) => t.board_id === board.id),
  }))

  return {
    project: (projectRes.data as Project) ?? null,
    boards: boardsWithTasks,
    allTasks,
  }
}

export async function getBoardWithTasks(id: string): Promise<{
  board: Board | null
  tasks: Task[]
}> {
  if (!supabase) return { board: null, tasks: [] }

  const [boardRes, tasksRes] = await Promise.all([
    supabase.from('boards').select('*').eq('id', id).single(),
    supabase.from('tasks').select('*').eq('board_id', id).order('priority', { ascending: true }).order('created_at', { ascending: true }),
  ])

  if (boardRes.error) { console.error('getBoardWithTasks board error:', boardRes.error) }
  if (tasksRes.error) { console.error('getBoardWithTasks tasks error:', tasksRes.error) }

  return {
    board: (boardRes.data as Board) ?? null,
    tasks: (tasksRes.data as Task[]) ?? [],
  }
}

export async function getAllTasks(filters?: { kind?: string; daimyo?: string; search?: string }): Promise<Task[]> {
  if (!supabase) return []
  let query = supabase.from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (filters?.kind) query = query.eq('kind', filters.kind)
  if (filters?.daimyo) query = query.eq('daimyo', filters.daimyo)
  if (filters?.search) query = query.ilike('title', `%${filters.search}%`)
  const { data, error } = await query
  if (error) { console.error('getAllTasks error:', error); return [] }
  return (data as Task[]) ?? []
}

export async function getMissionStats(): Promise<{ active: number; total: number }> {
  if (!supabase) return { active: 0, total: 0 }
  const [activeRes, totalRes] = await Promise.all([
    supabase.from('missions').select('id', { count: 'exact', head: true }).in('status', ['queued', 'running']),
    supabase.from('missions').select('id', { count: 'exact', head: true }),
  ])
  return {
    active: activeRes.count ?? 0,
    total: totalRes.count ?? 0,
  }
}

export async function getDynastyStats(): Promise<DynastyStats> {
  const defaults: DynastyStats = { totalProjects: 0, activeProjects: 0, totalTasks: 0, activeTasks: 0 }
  if (!supabase) return defaults

  const [projectsRes, activeProjectsRes, tasksRes, activeTasksRes] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('id', { count: 'exact', head: true }).in('status', ['inprogress', 'queue']),
    supabase.from('tasks').select('id', { count: 'exact', head: true }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['in_progress', 'assigned', 'todo', 'review', 'blocked']),
  ])

  return {
    totalProjects: projectsRes.count ?? 0,
    activeProjects: activeProjectsRes.count ?? 0,
    totalTasks: tasksRes.count ?? 0,
    activeTasks: activeTasksRes.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Proposal triage queries
// ---------------------------------------------------------------------------

export async function getProjectProposals(projectId: string): Promise<Proposal[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('status', 'pending')
    .or(`project_id.eq.${projectId},project_id.is.null`)
    .order('created_at', { ascending: false })
  if (error) { console.error('getProjectProposals error:', error); return [] }
  return (data as Proposal[]) ?? []
}

export async function getProposals(status?: string): Promise<Proposal[]> {
  if (!supabase) return []
  let query = supabase
    .from('proposals')
    .select('*')
    .order('created_at', { ascending: false })
  if (status) {
    query = query.eq('status', status)
  }
  const { data, error } = await query
  if (error) { console.error('getProposals error:', error); return [] }
  return (data as Proposal[]) ?? []
}

export async function getAllPendingProposals(): Promise<Proposal[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) { console.error('getAllPendingProposals error:', error); return [] }
  return (data as Proposal[]) ?? []
}

export async function approveProposal(proposalId: string, projectId: string): Promise<{ task: Task; missionPending: boolean; daimyo: string } | null> {
  try {
    const res = await fetch(`/api/proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', projectId }),
    })
    if (!res.ok) {
      console.error('approveProposal API error:', await res.text())
      return null
    }
    return await res.json()
  } catch (err) {
    console.error('approveProposal error:', err)
    return null
  }
}

export async function rejectProposal(proposalId: string): Promise<void> {
  try {
    await fetch(`/api/proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    })
  } catch (err) {
    console.error('rejectProposal error:', err)
  }
}

export async function startMission(missionId: string): Promise<boolean> {
  if (!supabase) return false
  const now = new Date().toISOString()
  const { error } = await supabase.from('missions').update({
    status: 'running',
    started_at: now,
  }).eq('id', missionId).eq('status', 'queued')
  if (error) { console.error('startMission error:', error); return false }
  return true
}

export async function getMissionByProposal(proposalId: string): Promise<Mission | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .eq('proposal_id', proposalId)
    .limit(1)
    .maybeSingle()
  if (error) { console.error('getMissionByProposal error:', error); return null }
  return (data as Mission) ?? null
}

export async function getProjectMissions(projectId: string): Promise<Mission[]> {
  if (!supabase) return []
  // Missions are linked to projects via proposals table
  // First get proposal IDs for this project, then get their missions
  const { data: proposals, error: propError } = await supabase
    .from('proposals')
    .select('id')
    .eq('project_id', projectId)

  if (propError || !proposals?.length) return []

  const proposalIds = proposals.map(p => p.id)
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .in('proposal_id', proposalIds)
    .order('created_at', { ascending: false })

  if (error) { console.error('getProjectMissions error:', error); return [] }
  return data as Mission[]
}

export async function getProjectMissionsWithSteps(projectId: string): Promise<(Mission & { stepCounts: { total: number; completed: number }; description: string | null })[]> {
  if (!supabase) return []

  const missions = await getProjectMissions(projectId)
  if (!missions.length) return []

  // Get step counts and proposal descriptions for all missions in parallel
  const proposalIds = missions.map(m => m.proposal_id).filter((id): id is string => id != null)

  const [stepsRes, proposalsRes] = await Promise.all([
    supabase
      .from('steps')
      .select('mission_id, status')
      .in('mission_id', missions.map(m => m.id)),
    proposalIds.length > 0
      ? supabase.from('proposals').select('id, description').in('id', proposalIds)
      : Promise.resolve({ data: [] as { id: string; description: string | null }[], error: null }),
  ])

  if (stepsRes.error) { console.error('getProjectMissionsWithSteps steps error:', stepsRes.error) }
  if (proposalsRes.error) { console.error('getProjectMissionsWithSteps proposals error:', proposalsRes.error) }

  const stepsByMission = (stepsRes.data ?? []).reduce((acc, s) => {
    if (!acc[s.mission_id]) acc[s.mission_id] = { total: 0, completed: 0 }
    acc[s.mission_id].total++
    if (s.status === 'completed') acc[s.mission_id].completed++
    return acc
  }, {} as Record<string, { total: number; completed: number }>)

  const descriptionByProposalId = ((proposalsRes.data ?? []) as { id: string; description: string | null }[]).reduce((acc, p) => {
    acc[p.id] = p.description
    return acc
  }, {} as Record<string, string | null>)

  return missions.map(m => ({
    ...m,
    stepCounts: stepsByMission[m.id] ?? { total: 0, completed: 0 },
    description: m.proposal_id ? (descriptionByProposalId[m.proposal_id] ?? null) : null,
  }))
}

export async function getTaskByProposal(proposalId: string): Promise<Task | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('proposal_id', proposalId)
    .limit(1)
    .maybeSingle()
  if (error) { console.error('getTaskByProposal error:', error); return null }
  return (data as Task) ?? null
}

export async function getStaleTasks(): Promise<Task[]> {
  if (!supabase) return []
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .lt('updated_at', cutoff)
    .not('status', 'in', '("done","queue")')
    .order('updated_at', { ascending: true })
  if (error) { console.error('getStaleTasks error:', error); return [] }
  return (data as Task[]) ?? []
}

// ---------------------------------------------------------------------------
// Council session queries
// ---------------------------------------------------------------------------

export async function getCouncilSessions(limit = 20, filter?: { status?: 'active' | 'archived' }): Promise<CouncilSession[]> {
  if (!supabase) return []
  let query = supabase
    .from('council_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  const statusFilter = filter?.status ?? 'active'
  query = query.eq('status', statusFilter)
  const { data, error } = await query
  if (error) { console.error('getCouncilSessions error:', error); return [] }
  return data as CouncilSession[]
}

export async function archiveCouncilSession(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('council_sessions')
    .update({ status: 'archived' })
    .eq('id', id)
  if (error) { console.error('archiveCouncilSession error:', error); return false }
  return true
}

export async function deleteCouncilSession(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('council_sessions')
    .delete()
    .eq('id', id)
  if (error) { console.error('deleteCouncilSession error:', error); return false }
  return true
}

export async function getCouncilSession(id: string): Promise<CouncilSession | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('council_sessions')
    .select('*')
    .eq('id', id)
    .single()
  if (error) { console.error('getCouncilSession error:', error); return null }
  return data as CouncilSession
}

export async function createCouncilSession(
  session: Omit<CouncilSession, 'id' | 'created_at'>
): Promise<CouncilSession | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('council_sessions')
    .insert(session)
    .select()
    .single()
  if (error) { console.error('createCouncilSession error:', error); return null }
  return data as CouncilSession
}

// ---------------------------------------------------------------------------
// Create project / mission (used by council actions + dashboard)
// ---------------------------------------------------------------------------

export async function createProject(input: {
  title: string
  description?: string
  status?: string
  councilSessionId?: string
  objectiveId?: string
}): Promise<Project | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('projects')
    .insert({
      id: crypto.randomUUID(),
      title: input.title,
      goal: input.description ?? null,
      status: input.status ?? 'todo',
      priority: 50,
      ...(input.objectiveId ? { objective_id: input.objectiveId } : {}),
    })
    .select()
    .single()
  if (error) { console.error('createProject error:', error); return null }
  if (input.councilSessionId) {
    await archiveCouncilSession(input.councilSessionId)
  }
  return data as Project
}

// ---------------------------------------------------------------------------
// Discovery queries
// ---------------------------------------------------------------------------

export async function getDiscoveriesByRepo(repo: string): Promise<Discovery[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('discoveries')
    .select('*')
    .eq('repo', repo)
    .order('created_at', { ascending: false })
  if (error) { console.error('getDiscoveriesByRepo error:', error); return [] }
  return (data as Discovery[]) ?? []
}

export async function getPendingDiscoveryCount(): Promise<number> {
  if (!supabase) return 0
  const { count, error } = await supabase
    .from('discoveries')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) { console.error('getPendingDiscoveryCount error:', error); return 0 }
  return count ?? 0
}

export async function getPendingDiscoveriesWithSeverity(): Promise<{ total: number; critical: number; warning: number; info: number }> {
  if (!supabase) return { total: 0, critical: 0, warning: 0, info: 0 }
  const { data, error } = await supabase
    .from('discoveries')
    .select('severity')
    .eq('status', 'pending')
  if (error) { console.error('getPendingDiscoveriesWithSeverity error:', error); return { total: 0, critical: 0, warning: 0, info: 0 } }
  const rows = (data ?? []) as { severity: string }[]
  return {
    total: rows.length,
    critical: rows.filter(r => r.severity === 'critical').length,
    warning: rows.filter(r => r.severity === 'warning').length,
    info: rows.filter(r => r.severity === 'info').length,
  }
}

export async function getLastPatrolEvent(): Promise<Event | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('war_room_events')
    .select('*')
    .eq('event_type', 'patrol_complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) { console.error('getLastPatrolEvent error:', error); return null }
  return data as Event | null
}

export async function getDiscoveryCountByRepo(repo: string): Promise<number> {
  if (!supabase) return 0
  const { count, error } = await supabase
    .from('discoveries')
    .select('*', { count: 'exact', head: true })
    .eq('repo', repo)
    .eq('status', 'pending')
  if (error) { console.error('getDiscoveryCountByRepo error:', error); return 0 }
  return count ?? 0
}

export async function getDiscoveryFeedbackStats(): Promise<
  { agent_id: string; category: string; approved_count: number; dismissed_count: number; total_count: number }[]
> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('discoveries')
    .select('agent_id, category, status')
    .in('status', ['approved', 'dismissed'])
  if (error) { console.error('getDiscoveryFeedbackStats error:', error); return [] }
  const rows = (data ?? []) as { agent_id: string; category: string; status: string }[]
  const groups: Record<string, { agent_id: string; category: string; approved_count: number; dismissed_count: number }> = {}
  for (const row of rows) {
    const key = `${row.agent_id}:${row.category}`
    if (!groups[key]) {
      groups[key] = { agent_id: row.agent_id, category: row.category, approved_count: 0, dismissed_count: 0 }
    }
    if (row.status === 'approved') groups[key].approved_count++
    else groups[key].dismissed_count++
  }
  return Object.values(groups).map(g => ({ ...g, total_count: g.approved_count + g.dismissed_count }))
}

export async function createMission(input: {
  title: string
  project_id: string
  assigned_to?: string
  status?: string
  councilSessionId?: string
  priority?: 1 | 2 | 3 | 4
}): Promise<Mission | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('missions')
    .insert({
      id: crypto.randomUUID(),
      title: input.title,
      project_id: input.project_id,
      assigned_to: input.assigned_to ?? 'unassigned',
      status: input.status ?? 'queued',
      priority: input.priority ?? 3,
    })
    .select()
    .single()
  if (error) { console.error('createMission error:', error); return null }
  if (input.councilSessionId) {
    await archiveCouncilSession(input.councilSessionId)
  }
  return data as Mission
}

export async function createObjective(params: {
  title: string;
  description?: string;
  success_criteria: string;
  max_iterations?: number;
  project_id?: string;
}): Promise<{ id: string } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("objectives")
    .insert({
      title: params.title,
      description: params.description || null,
      success_criteria: params.success_criteria,
      max_iterations: params.max_iterations ?? 5,
      project_id: params.project_id || null,
      status: "active",
      created_by: "sensei",
      iteration_count: 0,
    })
    .select("id")
    .single();
  if (error) {
    console.error("createObjective error:", error);
    return null;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Active agents queries
// ---------------------------------------------------------------------------

export async function getActiveAgents(): Promise<ActiveAgent[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('active_agents')
    .select('*')
    .in('status', ['running', 'idle'])
    .order('started_at', { ascending: false })
  if (error) { console.error('getActiveAgents error:', error); return [] }
  return data as ActiveAgent[]
}

export async function createMissionFromPlan(planData: {
  title: string
  description: string
  projectId?: string
  tasks: Array<{ subject: string; description: string }>
  source?: string
}): Promise<{ missionId: string; taskIds: string[] } | null> {
  const res = await fetch('/api/missions/from-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: planData.title,
      description: planData.description,
      projectId: planData.projectId,
      tasks: planData.tasks,
      source: planData.source ?? 'claude-code',
    }),
  })
  if (!res.ok) {
    console.error('createMissionFromPlan failed:', await res.text())
    return null
  }
  return res.json() as Promise<{ missionId: string; taskIds: string[] }>
}

export async function getSkillPatchStats(): Promise<{ recentPatches: number; appliedPatches: number }> {
  if (!supabase) return { recentPatches: 0, appliedPatches: 0 }
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [recentRes, appliedRes] = await Promise.all([
    supabase.from('skill_patches').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    supabase.from('skill_patches').select('id', { count: 'exact', head: true }).eq('applied', true),
  ])
  return {
    recentPatches: recentRes.count ?? 0,
    appliedPatches: appliedRes.count ?? 0,
  }
}

export async function getLastPatrolSummary(): Promise<{ timestamp: string | null; discoveryCount: number }> {
  if (!supabase) return { timestamp: null, discoveryCount: 0 }
  const [patrolRes, countRes] = await Promise.all([
    supabase
      .from('war_room_events')
      .select('created_at')
      .eq('event_type', 'patrol_complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('discoveries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])
  return {
    timestamp: patrolRes.data?.created_at ?? null,
    discoveryCount: countRes.count ?? 0,
  }
}

export async function getActiveObjectiveCount(): Promise<number> {
  if (!supabase) return 0
  const { count } = await supabase
    .from('objectives')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  return count ?? 0
}

export async function getObjectivesWithMetrics(): Promise<ObjectiveWithMetrics[]> {
  if (!supabase) return []

  // Fetch objectives, all missions (for progress), and pending proposals in parallel
  const [objectivesRes, missionsRes, proposalsRes] = await Promise.all([
    supabase.from('objectives').select('*').order('created_at', { ascending: false }),
    supabase.from('missions').select('id, objective_id, status'),
    supabase.from('proposals').select('id, objective_id').eq('status', 'pending'),
  ])

  const objectives = (objectivesRes.data as Objective[]) ?? []
  const missions = (missionsRes.data ?? []) as { id: string; objective_id: string | null; status: string }[]
  const proposals = (proposalsRes.data ?? []) as { id: string; objective_id: string | null }[]

  return objectives.map(obj => {
    const objMissions = missions.filter(m => m.objective_id === obj.id)
    return {
      ...obj,
      totalMissions: objMissions.length,
      completedMissions: objMissions.filter(m => m.status === 'completed' || m.status === 'deployed').length,
      activeMissions: objMissions.filter(m => m.status === 'queued' || m.status === 'running').length,
      pendingProposals: proposals.filter(p => p.objective_id === obj.id).length,
    }
  })
}

export async function getObjectiveWithRelated(id: string): Promise<{
  objective: Objective | null
  projects: Project[]
  missions: Mission[]
  proposals: Proposal[]
}> {
  if (!supabase) return { objective: null, projects: [], missions: [], proposals: [] }

  const [objectiveRes, projectsRes, missionsRes, proposalsRes] = await Promise.all([
    supabase.from('objectives').select('*').eq('id', id).single(),
    supabase.from('projects').select('*').eq('objective_id', id).order('priority', { ascending: true }),
    supabase.from('missions').select('*').eq('objective_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('proposals').select('*').eq('objective_id', id).order('created_at', { ascending: false }).limit(50),
  ])

  if (objectiveRes.error) { console.error('getObjectiveWithRelated objective error:', objectiveRes.error) }
  if (projectsRes.error) { console.error('getObjectiveWithRelated projects error:', projectsRes.error) }
  if (missionsRes.error) { console.error('getObjectiveWithRelated missions error:', missionsRes.error) }
  if (proposalsRes.error) { console.error('getObjectiveWithRelated proposals error:', proposalsRes.error) }

  return {
    objective: (objectiveRes.data as Objective) ?? null,
    projects: (projectsRes.data as Project[]) ?? [],
    missions: (missionsRes.data as Mission[]) ?? [],
    proposals: (proposalsRes.data as Proposal[]) ?? [],
  }
}

export async function getActiveCouncilSessionCount(): Promise<number> {
  if (!supabase) return 0
  const { count, error } = await supabase
    .from('council_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
  if (error) { console.error('getActiveCouncilSessionCount error:', error); return 0 }
  return count ?? 0
}

export async function getAwarenessProposalCount(): Promise<number> {
  if (!supabase) return 0
  const { count, error } = await supabase
    .from('proposals')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'awareness')
    .eq('status', 'pending')
  if (error) { console.error('getAwarenessProposalCount error:', error); return 0 }
  return count ?? 0
}

export async function archiveFailed(): Promise<{ archived: number }> {
  if (!supabase) return { archived: 0 }
  const { data, error } = await supabase
    .from('missions')
    .update({ status: 'archived' })
    .eq('status', 'failed')
    .select('id')
  if (error) { console.error('archiveFailed error:', error); return { archived: 0 } }
  return { archived: data?.length ?? 0 }
}

export async function getActiveWorkers(): Promise<ActiveWorker[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, kind, daimyo, started_at, mission_id')
    .eq('status', 'in_progress')
    .order('started_at', { ascending: true })
  if (error) { console.error('getActiveWorkers error:', error); return [] }
  return (data ?? []) as ActiveWorker[]
}

export async function getDaimyoActivity(): Promise<Record<string, number>> {
  if (!supabase) return {}
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('missions')
    .select('assigned_to')
    .eq('status', 'completed')
    .gte('completed_at', sevenDaysAgo)
  if (error) { console.error('getDaimyoActivity error:', error); return {} }
  const counts: Record<string, number> = {}
  for (const row of (data ?? [])) {
    const agent = (row as { assigned_to: string }).assigned_to
    counts[agent] = (counts[agent] ?? 0) + 1
  }
  return counts
}

export async function getDashboardCounts() {
  if (!supabase) return { activeSessions: 0, agentsOnline: 0, tasksRunning: 0, errors24h: 0 }
  const [sessionsRes, agentsRes, tasksRes, errorsRes] = await Promise.all([
    supabase.from('missions').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('agent_status').select('id', { count: 'exact', head: true }).neq('status', 'offline'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('missions').select('id', { count: 'exact', head: true }).eq('status', 'failed')
      .gte('completed_at', new Date(Date.now() - 86400000).toISOString()),
  ])
  return {
    activeSessions: sessionsRes.count ?? 0,
    agentsOnline: agentsRes.count ?? 0,
    tasksRunning: tasksRes.count ?? 0,
    errors24h: errorsRes.count ?? 0,
  }
}

export async function getRecentSessions(limit = 8) {
  if (!supabase) return []
  const { data } = await supabase.from('missions')
    .select('id, title, assigned_to, status, started_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getRecentLogs(limit = 8) {
  if (!supabase) return []
  const { data } = await supabase.from('war_room_events')
    .select('id, event_type, title, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getAgentGrid() {
  if (!supabase) return []
  const { data, error } = await supabase.from('agent_status')
    .select('*')
    .order('name')
  if (error) { console.error('getAgentGrid error:', error); return [] }
  return data ?? []
}

// ---------------------------------------------------------------------------
// Operations Hub queries (Sprint 1 Group C)
// ---------------------------------------------------------------------------

// Get task counts grouped by status for pipeline view
export async function getTaskPipelineCounts() {
  if (!supabase) return { proposed: 0, in_progress: 0, review: 0, done: 0, failed: 0 }
  const { data, error } = await supabase
    .from('tasks')
    .select('status')

  if (error || !data) return { proposed: 0, in_progress: 0, review: 0, done: 0, failed: 0 }

  const counts: Record<string, number> = {}
  for (const task of data) {
    counts[task.status] = (counts[task.status] || 0) + 1
  }
  return {
    proposed: counts['proposed'] || 0,
    in_progress: counts['in_progress'] || 0,
    review: counts['review'] || 0,
    done: counts['done'] || 0,
    failed: counts['failed'] || 0,
  }
}

// Get outcome counts mapped to Research/Aeon/OPSEC/Messages categories
export async function getOutcomeCounts(): Promise<Record<string, OutcomeCard>> {
  if (!supabase) return {
    research: { category: 'research', headline: 'Unavailable', detail: null, count: 0 },
    aeon: { category: 'aeon', headline: 'Unavailable', detail: null, count: 0 },
    opsec: { category: 'opsec', headline: 'Unavailable', detail: null, count: 0 },
    messages: { category: 'messages', headline: 'Unavailable', detail: null, count: 0 },
    plans: { category: 'plans', headline: 'Unavailable', detail: null, count: 0 },
  }

  // Research: try research_findings table (may not exist yet)
  let researchCount = 0
  let researchItems: { title: string; timestamp: string; status?: string }[] = []
  let researchHeadline = 'Research pipeline initializing'
  try {
    const [findings, findingsCount] = await Promise.all([
      supabase.from('research_findings').select('id, title, created_at, status').order('created_at', { ascending: false }).limit(3),
      supabase.from('research_findings').select('id', { count: 'exact', head: true }),
    ])
    if (!findings.error && findings.data) {
      researchItems = findings.data.map((f: { title: string; created_at: string; status: string }) => ({ title: f.title, timestamp: f.created_at, status: f.status }))
      researchCount = findingsCount.count || 0
      researchHeadline = researchCount > 0 ? `${researchCount} findings` : 'No findings yet'
    }
  } catch {
    // Table doesn't exist yet — show initializing state
  }

  // Aeon: proposals where domain in ('commerce', 'product'), excluding patrol/awareness noise
  const [aeonData, aeonCount] = await Promise.all([
    supabase.from('proposals').select('id, title, created_at, status, cost_estimate').in('domain', ['commerce', 'product']).not('source', 'in', '("patrol","awareness")').order('created_at', { ascending: false }).limit(3),
    supabase.from('proposals').select('id', { count: 'exact', head: true }).in('domain', ['commerce', 'product']).not('source', 'in', '("patrol","awareness")'),
  ])
  const aeonTotal = aeonCount.count || 0

  // OPSEC: patrol discoveries + awareness proposals + 24h error count
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const [opsecProposals, opsecProposalCount, discoveries, discoveryCount, errors24h] = await Promise.all([
    supabase.from('proposals').select('id, title, created_at, status').in('source', ['patrol', 'awareness']).order('created_at', { ascending: false }).limit(3),
    supabase.from('proposals').select('id', { count: 'exact', head: true }).in('source', ['patrol', 'awareness']),
    supabase.from('discoveries').select('id, title, created_at, status').in('status', ['pending', 'new']).order('created_at', { ascending: false }).limit(3),
    supabase.from('discoveries').select('id', { count: 'exact', head: true }).in('status', ['pending', 'new']),
    supabase.from('missions').select('id', { count: 'exact' }).eq('status', 'failed').gte('created_at', yesterday),
  ])

  const opsecItems = [
    ...(opsecProposals.data || []).map((p: { title: string; created_at: string; status: string }) => ({ title: p.title, timestamp: p.created_at, status: p.status })),
    ...(discoveries.data || []).map((d: { title: string; created_at: string; status: string }) => ({ title: d.title, timestamp: d.created_at, status: d.status })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 3)

  const opsecFindingsCount = (opsecProposalCount.count || 0) + (discoveryCount.count || 0)
  const opsecErrorCount = errors24h.count || 0
  const opsecTotalCount = opsecFindingsCount + opsecErrorCount

  // Messages: brief/notification/message events from last 24h
  const [msgEvents, msgEventCount] = await Promise.all([
    supabase.from('war_room_events').select('id, title, created_at, event_type').in('event_type', ['brief', 'notification', 'message']).order('created_at', { ascending: false }).limit(3),
    supabase.from('war_room_events').select('id', { count: 'exact', head: true }).in('event_type', ['brief', 'notification', 'message']).gte('created_at', yesterday),
  ])

  const msgCount = msgEvents.data?.length || 0
  const unreadCount = msgEventCount.count || 0

  // Plans: reviewing + running + approved
  const [plansActive, plansActiveCount, plansReviewingCount] = await Promise.all([
    supabase.from('plans').select('id, title, created_at, status').in('status', ['reviewing', 'running', 'approved']).order('created_at', { ascending: false }).limit(3),
    supabase.from('plans').select('id', { count: 'exact', head: true }).in('status', ['reviewing', 'running', 'approved']),
    supabase.from('plans').select('id', { count: 'exact', head: true }).eq('status', 'reviewing'),
  ])
  const plansCount = plansActiveCount.count || 0
  const reviewingCount = plansReviewingCount.count || 0
  let plansHeadline = 'No active plans'
  if (plansCount > 0) {
    const parts: string[] = []
    if (reviewingCount > 0) parts.push(`${reviewingCount} need review`)
    parts.push(`${plansCount} active`)
    plansHeadline = parts.join(' · ')
  }

  return {
    research: {
      category: 'research' as const,
      headline: researchHeadline,
      detail: researchCount === 0 ? 'Research pipeline initializing — findings will appear once scanning tools are wired' : null,
      count: researchCount,
      actionLabel: researchCount > 0 ? 'View' : undefined,
      actionHref: researchCount > 0 ? '/research' : undefined,
      items: researchItems,
    },
    aeon: {
      category: 'aeon' as const,
      headline: aeonTotal > 0 ? `${aeonTotal} proposals` : 'No proposals yet',
      detail: null,
      count: aeonTotal,
      actionLabel: aeonTotal > 0 ? 'Review' : undefined,
      actionHref: aeonTotal > 0 ? '/missions' : undefined,
      items: (aeonData.data || []).map((p: { title: string; created_at: string; status: string }) => ({ title: p.title, timestamp: p.created_at, status: p.status })),
    },
    opsec: {
      category: 'opsec' as const,
      headline: opsecErrorCount > 0
        ? `${opsecErrorCount} errors (24h) · ${opsecFindingsCount} findings`
        : opsecFindingsCount > 0
          ? `${opsecFindingsCount} findings`
          : '0 errors (24h)',
      detail: null,
      count: opsecTotalCount,
      actionLabel: opsecTotalCount > 0 ? 'View' : undefined,
      actionHref: opsecTotalCount > 0 ? '/discoveries' : undefined,
      items: opsecItems,
    },
    messages: {
      category: 'messages' as const,
      headline: msgCount > 0 ? `${msgCount} recent` : 'No briefs yet',
      detail: null,
      count: unreadCount,
      actionLabel: 'View All',
      actionHref: '/events',
      items: (msgEvents.data || []).map((e: { title: string; created_at: string; event_type: string }) => ({ title: e.title, timestamp: e.created_at, status: e.event_type })),
    },
    plans: {
      category: 'plans' as const,
      headline: plansHeadline,
      detail: null,
      count: plansCount,
      actionLabel: 'View Plans',
      actionHref: '/plans',
      items: (plansActive.data || []).map((p: { title: string; created_at: string; status: string }) => ({ title: p.title, timestamp: p.created_at, status: p.status })),
    },
  }
}

// ---------------------------------------------------------------------------
// Research findings queries (Sprint 2)
// ---------------------------------------------------------------------------

export async function getResearchFindings(limit = 20, status?: string): Promise<ResearchFinding[]> {
  if (!supabase) return []
  let query = supabase
    .from('research_findings')
    .select('*')
    .order('created_at', { ascending: false })
  if (status) {
    query = query.eq('status', status)
  }
  const { data, error } = await query.limit(limit)
  if (error) { console.error('getResearchFindings error:', error); return [] }
  return (data || []) as ResearchFinding[]
}

export async function getResearchFindingsCount(): Promise<{ total: number; new: number; actionable: number }> {
  if (!supabase) return { total: 0, new: 0, actionable: 0 }
  const [total, newCount, actionable] = await Promise.all([
    supabase.from('research_findings').select('id', { count: 'exact', head: true }),
    supabase.from('research_findings').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('research_findings').select('id', { count: 'exact', head: true }).eq('status', 'actionable'),
  ])
  return {
    total: total.count ?? 0,
    new: newCount.count ?? 0,
    actionable: actionable.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Plan Runner queries (BEAD-003)
// ---------------------------------------------------------------------------

export async function getPlans(status?: string): Promise<Plan[]> {
  if (!supabase) return []
  let query = supabase
    .from('plans')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) { console.error('getPlans error:', error); return [] }
  return (data || []) as Plan[]
}

export async function getPlan(id: string): Promise<Plan | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .single()
  if (error) { console.error('getPlan error:', error); return null }
  return data as Plan
}

export async function getPlanMissions(planId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('missions')
    .select('id, title, status, assigned_to, wave_index, started_at, completed_at, created_at')
    .eq('plan_id', planId)
    .order('wave_index', { ascending: true })
  if (error) { console.error('getPlanMissions error:', error); return [] }
  return data || []
}
