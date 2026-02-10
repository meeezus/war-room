// Database types matching shogunate-engine schema.sql

export interface Proposal {
  id: string
  title: string
  description: string | null
  source: 'discord' | 'cron' | 'trigger' | 'manual'
  requested_by: string
  domain: 'engineering' | 'product' | 'commerce' | 'influence' | 'operations' | 'coordination' | null
  cost_estimate: number | null
  time_estimate: string | null // interval comes as string from Supabase
  risk_level: 'low' | 'medium' | 'high' | null
  auto_approved: boolean
  approved_at: string | null
  approved_by: string | null
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface Mission {
  id: string
  proposal_id: string | null
  title: string
  assigned_to: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stale'
  started_at: string | null
  completed_at: string | null
  result: Record<string, unknown> | null
  created_at: string
}

export interface Step {
  id: string
  mission_id: string | null
  title: string
  description: string | null
  kind: 'research' | 'code' | 'review' | 'test' | 'deploy' | 'write' | 'analyze' | null
  daimyo: string
  model: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stale'
  output: string | null
  error: string | null
  started_at: string | null
  completed_at: string | null
  timeout_minutes: number
  created_at: string
}

export interface Event {
  id: string
  type:
    | 'proposal_created' | 'proposal_approved' | 'proposal_rejected'
    | 'mission_started' | 'mission_completed' | 'mission_failed'
    | 'step_started' | 'step_completed' | 'step_failed' | 'step_stale'
    | 'heartbeat' | 'agent_action' | 'user_request'
  source_id: string | null
  agent: string | null
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AgentStatus {
  id: string
  name: string
  display_name: string
  domain: string
  model: string
  level: number
  status: 'online' | 'idle' | 'busy' | 'offline'
  current_mission_id: string | null
  last_heartbeat: string
  missions_completed: number
}

export interface CapGate {
  id: string
  max_cost_per_day: number
  max_time_per_mission: string // interval
  max_concurrent_missions: number
  auto_approve_cost_limit: number
  auto_approve_risk: string
}

export interface DashboardStats {
  activeAgents: number
  runningMissions: number
  queuedSteps: number
  todayProposals: number
}

// Dynasty-wide project tracking

export interface Project {
  id: string
  title: string
  status: 'inprogress' | 'todo' | 'done' | 'someday' | 'onhold'
  priority: number
  goal: string | null
  type: string | null
  owner: string | null
  notes: string | null
  next_action: string | null
  created_at: string
  updated_at: string
}

export interface Board {
  id: string
  project_id: string | null
  title: string
  description: string | null
  board_type: 'board' | 'epic'
  created_at: string
}

export interface Task {
  id: number
  board_id: string | null
  project_id: string | null
  title: string
  status: 'active' | 'todo' | 'done' | 'someday' | 'blocked'
  priority: number | null
  goal: string | null
  type: string | null
  owner: string | null
  notes: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface DynastyStats {
  totalProjects: number
  activeProjects: number
  totalTasks: number
  activeTasks: number
}
