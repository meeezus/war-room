"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, LayoutDashboard } from 'lucide-react'
import type { AgentStatus, Mission, Event, RpgStats, Proposal } from '@/lib/types'
import { getAgents, getMissions, getEvents, getAllPendingProposals } from '@/lib/queries'
import { useRealtimeAgents, useRealtimeMissions, useRealtimeEvents } from '@/lib/realtime'
import { DojoFloor } from '@/components/dojo/dojo-floor'
import { DojoChatPanel } from '@/components/dojo/dojo-chat-panel'
import { AgentStatPopup } from '@/components/dojo/agent-stat-popup'
import { MissionBoardOverlay } from '@/components/dojo/mission-board-overlay'
import { getRpgStats, getBaselineStats } from '@/lib/rpg-stats'
import { getRoleCard } from '@/lib/role-cards'

export default function DojoPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [chatAgent, setChatAgent] = useState<AgentStatus | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [agentStats, setAgentStats] = useState<Record<string, RpgStats>>({})
  const [popupAgent, setPopupAgent] = useState<AgentStatus | null>(null)
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [boardOverlayOpen, setBoardOverlayOpen] = useState(false)

  // Initial fetch
  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsData, missionsData, proposalsData, eventsData] = await Promise.all([
          getAgents(),
          getMissions(),
          getAllPendingProposals(),
          getEvents(20),
        ])
        setAgents(agentsData)
        setMissions(missionsData)
        setProposals(proposalsData)
        setEvents(eventsData)
      } catch (error) {
        console.error('Error fetching dojo data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Realtime updates
  const realtimeAgents = useRealtimeAgents(agents)
  const realtimeMissions = useRealtimeMissions(missions)
  const realtimeEvents = useRealtimeEvents(events)

  useEffect(() => {
    setAgents(realtimeAgents)
  }, [realtimeAgents])

  useEffect(() => {
    setMissions(realtimeMissions)
  }, [realtimeMissions])

  useEffect(() => {
    setEvents(realtimeEvents)
  }, [realtimeEvents])

  // Fetch RPG stats for all agents
  useEffect(() => {
    async function fetchStats() {
      const statsMap: Record<string, RpgStats> = {}
      for (const agent of agents) {
        try {
          const stats = await getRpgStats(agent.name)
          statsMap[agent.name] = stats
        } catch {
          statsMap[agent.name] = getBaselineStats()
        }
      }
      setAgentStats(statsMap)
    }
    if (agents.length > 0) fetchStats()
  }, [agents])

  // Build ring color map from role cards
  const agentRingColors: Record<string, string> = {}
  for (const agent of agents) {
    const card = getRoleCard(agent.name.toLowerCase())
    agentRingColors[agent.name.toLowerCase()] = card.color
  }

  const handleAgentClick = (agent: AgentStatus, position: { x: number; y: number }) => {
    setPopupAgent(agent)
    setPopupPosition(position)
  }

  const handleAgentInteract = (agent: AgentStatus) => {
    setChatAgent(agent)
    setChatOpen(true)
  }

  const handleBoardClick = () => {
    setBoardOverlayOpen(true)
  }

  const activeMissions = missions.filter(m => m.status === 'running' || m.status === 'queued')
  const recentEvents = events.slice(0, 10)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-zinc-950 text-zinc-400">
        <div className="flex items-center gap-2 font-[family-name:var(--font-jetbrains-mono)]">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Loading dojo...
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-400" />
              </Link>
              <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
                The Dojo
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/chat"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
              >
                <MessageSquare className="w-4 h-4" />
                Shoin Chat
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 border border-zinc-700 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            </div>
          </div>
        </header>

        {/* Dojo floor */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          <div className="relative">
            <DojoFloor
              agents={agents}
              missions={missions}
              onAgentInteract={handleAgentInteract}
              onAgentClick={handleAgentClick}
              agentRingColors={agentRingColors}
              onBoardClick={handleBoardClick}
              inputDisabled={chatOpen}
            />

            {/* Stat popup */}
            {popupAgent && (
              <AgentStatPopup
                agent={popupAgent}
                stats={agentStats[popupAgent.name] || getBaselineStats()}
                roleCard={getRoleCard(popupAgent.name.toLowerCase())}
                position={popupPosition}
                onClose={() => setPopupAgent(null)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`border-l border-zinc-800 bg-zinc-950/50 backdrop-blur-sm transition-all duration-300 ${
          sidebarCollapsed ? 'w-0' : 'w-80'
        } overflow-hidden flex flex-col`}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-balance">
            Mission Status
          </h2>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ArrowLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Active missions */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-[family-name:var(--font-space-grotesk)] font-medium text-zinc-400 mb-3">
                Active Missions ({activeMissions.length})
              </h3>
              {activeMissions.length === 0 ? (
                <p className="text-sm text-zinc-600 font-[family-name:var(--font-jetbrains-mono)]">
                  No active missions
                </p>
              ) : (
                <div className="space-y-2">
                  {activeMissions.map((mission) => {
                    const agent = agents.find(a => a.name === mission.assigned_to)
                    const statusColors = {
                      running: 'bg-emerald-600',
                      queued: 'bg-yellow-600',
                      completed: 'bg-zinc-600',
                      failed: 'bg-red-600',
                      stale: 'bg-zinc-700',
                    }
                    return (
                      <div
                        key={mission.id}
                        className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${statusColors[mission.status]}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-pretty line-clamp-2">
                              {mission.title}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 font-[family-name:var(--font-jetbrains-mono)]">
                          <span>{agent?.display_name || mission.assigned_to}</span>
                          <span>•</span>
                          <span className="capitalize">{mission.status}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent events */}
            <div>
              <h3 className="text-sm font-[family-name:var(--font-space-grotesk)] font-medium text-zinc-400 mb-3">
                Recent Events
              </h3>
              {recentEvents.length === 0 ? (
                <p className="text-sm text-zinc-600 font-[family-name:var(--font-jetbrains-mono)]">
                  No recent events
                </p>
              ) : (
                <div className="space-y-2">
                  {recentEvents.map((event) => {
                    const eventTypeColors = {
                      'mission_started': 'text-emerald-400',
                      'mission_completed': 'text-blue-400',
                      'mission_failed': 'text-red-400',
                      'proposal_created': 'text-yellow-400',
                      'proposal_approved': 'text-emerald-400',
                      'agent_action': 'text-purple-400',
                    }
                    const color = eventTypeColors[event.type as keyof typeof eventTypeColors] || 'text-zinc-400'
                    return (
                      <div
                        key={event.id}
                        className="p-2 bg-zinc-900/50 border border-zinc-800/50 rounded text-xs"
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1 ${color.replace('text-', 'bg-')}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${color} text-pretty`}>
                              {event.type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-zinc-500 font-[family-name:var(--font-jetbrains-mono)] mt-1 text-pretty">
                              {event.message}
                            </p>
                            <p className="text-zinc-600 font-[family-name:var(--font-jetbrains-mono)] mt-1">
                              {new Date(event.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Collapse toggle (when sidebar is collapsed) */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="fixed right-4 top-20 p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors shadow-lg z-20"
          title="Expand sidebar"
        >
          <ArrowLeft className="w-4 h-4 rotate-180" />
        </button>
      )}

      {/* Dojo chat panel */}
      <DojoChatPanel
        agent={chatAgent}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {/* Mission board overlay */}
      <MissionBoardOverlay
        missions={missions}
        proposals={proposals}
        agents={agents}
        open={boardOverlayOpen}
        onClose={() => setBoardOverlayOpen(false)}
      />
    </div>
  )
}
