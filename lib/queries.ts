import { supabase } from '@/lib/supabase'
import type { AgentStatus, Mission, Step, Event, DashboardStats, Project, Board, Task, DynastyStats } from '@/lib/types'

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

export async function getMissionWithSteps(id: string): Promise<{ mission: Mission | null; steps: Step[] }> {
  if (!supabase) return { mission: null, steps: [] }

  const [missionRes, stepsRes] = await Promise.all([
    supabase.from('missions').select('*').eq('id', id).single(),
    supabase.from('steps').select('*').eq('mission_id', id).order('created_at', { ascending: true }),
  ])

  if (missionRes.error) { console.error('getMissionWithSteps mission error:', missionRes.error) }
  if (stepsRes.error) { console.error('getMissionWithSteps steps error:', stepsRes.error) }

  return {
    mission: (missionRes.data as Mission) ?? null,
    steps: (stepsRes.data as Step[]) ?? [],
  }
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
  const defaults: DashboardStats = { activeAgents: 0, runningMissions: 0, queuedSteps: 0, todayProposals: 0 }
  if (!supabase) return defaults

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [agentsRes, missionsRes, stepsRes, proposalsRes] = await Promise.all([
    supabase.from('agent_status').select('id', { count: 'exact', head: true }).in('status', ['online', 'busy']),
    supabase.from('missions').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('steps').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
    supabase.from('proposals').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
  ])

  return {
    activeAgents: agentsRes.count ?? 0,
    runningMissions: missionsRes.count ?? 0,
    queuedSteps: stepsRes.count ?? 0,
    todayProposals: proposalsRes.count ?? 0,
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

export async function getProjectWithBoards(id: string): Promise<{
  project: Project | null
  boards: (Board & { tasks: Task[] })[]
}> {
  if (!supabase) return { project: null, boards: [] }

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

export async function getDynastyStats(): Promise<DynastyStats> {
  const defaults: DynastyStats = { totalProjects: 0, activeProjects: 0, totalTasks: 0, activeTasks: 0 }
  if (!supabase) return defaults

  const [projectsRes, activeProjectsRes, tasksRes, activeTasksRes] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('id', { count: 'exact', head: true }).in('status', ['inprogress', 'todo']),
    supabase.from('tasks').select('id', { count: 'exact', head: true }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['active', 'todo', 'blocked']),
  ])

  return {
    totalProjects: projectsRes.count ?? 0,
    activeProjects: activeProjectsRes.count ?? 0,
    totalTasks: tasksRes.count ?? 0,
    activeTasks: activeTasksRes.count ?? 0,
  }
}
