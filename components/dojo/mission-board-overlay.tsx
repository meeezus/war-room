"use client"

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Mission, Proposal, AgentStatus } from '@/lib/types'
import { MissionKanbanCard, type MissionWithSteps } from '@/components/mission-kanban-card'
import { ProposalKanbanCard } from './proposal-kanban-card'

interface MissionBoardOverlayProps {
  missions: Mission[]
  proposals: Proposal[]
  agents: AgentStatus[]
  open: boolean
  onClose: () => void
}

interface StepCounts {
  total: number
  completed: number
}

const KANBAN_COLUMNS = [
  { key: 'proposals', label: 'Proposals', accent: '#f59e0b' },
  { key: 'in_progress', label: 'In Progress', accent: '#3b82f6' },
  { key: 'review', label: 'Review', accent: '#10b981' },
  { key: 'done', label: 'Done', accent: '#6b7280' },
] as const

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

export function MissionBoardOverlay({ missions, proposals, agents, open, onClose }: MissionBoardOverlayProps) {
  const [stepCounts, setStepCounts] = useState<Record<string, StepCounts>>({})
  const [localProposals, setLocalProposals] = useState(proposals)

  // Sync local proposals when props change
  useEffect(() => {
    setLocalProposals(proposals)
  }, [proposals])

  // Fetch step counts for all missions
  useEffect(() => {
    if (!open || !supabase || missions.length === 0) return

    async function fetchStepCounts() {
      const { data } = await supabase!
        .from('steps')
        .select('mission_id, status')
        .in('mission_id', missions.map(m => m.id))

      if (!data) return

      const counts: Record<string, StepCounts> = {}
      for (const s of data) {
        const mid = s.mission_id as string
        if (!counts[mid]) counts[mid] = { total: 0, completed: 0 }
        counts[mid].total++
        if (s.status === 'completed') counts[mid].completed++
      }
      setStepCounts(counts)
    }

    fetchStepCounts()
  }, [open, missions])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  // Stats
  const activeAgentCount = agents.filter(a => a.current_mission_id != null).length
  const inProgressCount = missions.filter(m => m.status === 'running').length
  const pendingProposalCount = localProposals.length

  // Column data
  const now = Date.now()

  const proposalCards = localProposals
  const inProgressCards = missions.filter(m => m.status === 'running' || m.status === 'queued')
  const reviewCards = missions.filter(
    m => m.status === 'completed' && m.completed_at && (now - new Date(m.completed_at).getTime()) <= TWENTY_FOUR_HOURS
  )
  const doneCards = missions.filter(
    m =>
      (m.status === 'completed' && m.completed_at && (now - new Date(m.completed_at).getTime()) > TWENTY_FOUR_HOURS) ||
      m.status === 'failed'
  )

  function toMissionWithSteps(mission: Mission): MissionWithSteps {
    return {
      ...mission,
      stepCounts: stepCounts[mission.id] || { total: 0, completed: 0 },
      description: null,
    }
  }

  function handleProposalApproved(proposalId: string) {
    setLocalProposals(prev => prev.filter(p => p.id !== proposalId))
  }

  function handleProposalRejected(proposalId: string) {
    setLocalProposals(prev => prev.filter(p => p.id !== proposalId))
  }

  const columnData: Record<string, { missions: Mission[]; proposals: Proposal[] }> = {
    proposals: { missions: [], proposals: proposalCards },
    in_progress: { missions: inProgressCards, proposals: [] },
    review: { missions: reviewCards, proposals: [] },
    done: { missions: doneCards, proposals: [] },
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl max-h-[85vh] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
              Mission Board
            </h2>
            {/* Stats bar */}
            <div className="mt-2 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px]">
                <span className="inline-block size-1.5 rounded-full bg-blue-500" />
                <span className="font-[family-name:var(--font-jetbrains-mono)] tabular-nums text-white/50">
                  {activeAgentCount}
                </span>
                <span className="text-white/30">active agents</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px]">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                <span className="font-[family-name:var(--font-jetbrains-mono)] tabular-nums text-white/50">
                  {inProgressCount}
                </span>
                <span className="text-white/30">in progress</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px]">
                <span className="inline-block size-1.5 rounded-full bg-amber-500" />
                <span className="font-[family-name:var(--font-jetbrains-mono)] tabular-nums text-white/50">
                  {pendingProposalCount}
                </span>
                <span className="text-white/30">proposals</span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors self-start"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Kanban columns */}
        <div className="flex h-full gap-3 overflow-x-auto px-6 pb-6 pt-4">
          {KANBAN_COLUMNS.map((col) => {
            const data = columnData[col.key]
            const cardCount = col.key === 'proposals' ? data.proposals.length : data.missions.length

            return (
              <div key={col.key} className="flex min-w-[200px] flex-1 flex-col">
                {/* Column header */}
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: col.accent }}
                  />
                  <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.5)]">
                    {col.label}
                  </span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tabular-nums text-[rgba(255,255,255,0.3)]">
                    {cardCount}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                  {col.key === 'proposals' && data.proposals.map((proposal) => (
                    <ProposalKanbanCard
                      key={proposal.id}
                      proposal={proposal}
                      onApproved={handleProposalApproved}
                      onRejected={handleProposalRejected}
                    />
                  ))}

                  {col.key !== 'proposals' && data.missions.map((mission) => (
                    <MissionKanbanCard key={mission.id} mission={toMissionWithSteps(mission)} />
                  ))}

                  {cardCount === 0 && (
                    <p className="px-1 py-4 text-center font-[family-name:var(--font-jetbrains-mono)] text-xs text-zinc-600">
                      None
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
