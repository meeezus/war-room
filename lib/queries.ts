import { supabase } from '@/lib/supabase'
import type { AgentStatus, Mission, Step, Event, DashboardStats, Project, ProjectWithMetrics, Board, Task, DynastyStats, Proposal } from '@/lib/types'

// Domain → Daimyo routing (matches engine/config.py DOMAIN_TO_DAIMYO)
export const DOMAIN_TO_DAIMYO: Record<string, string> = {
  engineering: 'ed',
  product: 'light',
  commerce: 'toji',
  influence: 'power',
  operations: 'major',
  coordination: 'pip',
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
  const { data, error } = await supabase
    .from('events')
    .select('*')
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
    supabase.from('events').select('*').eq('agent', id).order('created_at', { ascending: false }),
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

  const [agentsRes, inProgressRes, reviewRes, proposalsRes] = await Promise.all([
    supabase.from('agent_status').select('id', { count: 'exact', head: true }).in('status', ['online', 'busy']),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'review'),
    supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return {
    activeAgents: agentsRes.count ?? 0,
    inProgressTasks: inProgressRes.count ?? 0,
    pendingReviews: reviewRes.count ?? 0,
    pendingProposals: proposalsRes.count ?? 0,
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

export async function getProjectsWithMetrics(): Promise<ProjectWithMetrics[]> {
  if (!supabase) return []

  // Fetch projects, tasks, and pending proposals in parallel
  const [projectsRes, tasksRes, proposalsRes] = await Promise.all([
    supabase.from('projects').select('*').order('priority', { ascending: true }),
    supabase.from('tasks').select('id, project_id, status, updated_at'),
    supabase.from('proposals').select('id, project_id').eq('status', 'pending'),
  ])

  const projects = (projectsRes.data as Project[]) ?? []
  const tasks = (tasksRes.data ?? []) as { id: number; project_id: string | null; status: string; updated_at: string }[]
  const pendingProposals = (proposalsRes.data ?? []) as { id: string; project_id: string | null }[]

  const STATUS_ORDER: Record<string, number> = { inprogress: 0, todo: 1, onhold: 2, done: 3, someday: 4 }

  return projects.map(project => {
    const projectTasks = tasks.filter(t => t.project_id === project.id)
    const taskCounts = {
      todo: projectTasks.filter(t => t.status === 'todo').length,
      assigned: projectTasks.filter(t => t.status === 'assigned').length,
      queued: projectTasks.filter(t => t.status === 'queued').length,
      in_progress: projectTasks.filter(t => t.status === 'in_progress').length,
      review: projectTasks.filter(t => t.status === 'review').length,
      done: projectTasks.filter(t => t.status === 'done').length,
      blocked: projectTasks.filter(t => t.status === 'blocked').length,
      failed: projectTasks.filter(t => t.status === 'failed').length,
      someday: projectTasks.filter(t => t.status === 'someday').length,
    }
    const totalTasks = projectTasks.filter(t => t.status !== 'someday').length
    const activeTasks = taskCounts.todo + taskCounts.assigned + taskCounts.in_progress + taskCounts.review + taskCounts.blocked
    const lastActivity = projectTasks.length > 0
      ? projectTasks.reduce((latest, t) => t.updated_at > latest ? t.updated_at : latest, projectTasks[0].updated_at)
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
    supabase.from('tasks').select('*').eq('project_id', id).order('created_at', { ascending: true }),
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
    supabase.from('tasks').select('*').eq('board_id', id).order('created_at', { ascending: true }),
  ])

  if (boardRes.error) { console.error('getBoardWithTasks board error:', boardRes.error) }
  if (tasksRes.error) { console.error('getBoardWithTasks tasks error:', tasksRes.error) }

  return {
    board: (boardRes.data as Board) ?? null,
    tasks: (tasksRes.data as Task[]) ?? [],
  }
}

export async function getAllTasks() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('*, projects(title)')
    .order('updated_at', { ascending: false })
  if (error) { console.error('getAllTasks error:', error); return [] }
  return data ?? []
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
    supabase.from('projects').select('id', { count: 'exact', head: true }).in('status', ['inprogress', 'todo']),
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
    .not('status', 'in', '("done","someday")')
    .order('updated_at', { ascending: true })
  if (error) { console.error('getStaleTasks error:', error); return [] }
  return (data as Task[]) ?? []
}
