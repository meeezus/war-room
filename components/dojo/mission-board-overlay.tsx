"use client"

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Mission } from '@/lib/types'

interface MissionBoardOverlayProps {
  missions: Mission[]
  open: boolean
  onClose: () => void
}

interface StepCounts {
  total: number
  completed: number
}

const STATUS_ORDER: Mission['status'][] = ['running', 'queued', 'completed', 'failed', 'stale']

const STATUS_COLORS: Record<string, { dot: string; bar: string; badge: string; badgeText: string }> = {
  running: { dot: 'bg-blue-500', bar: 'bg-blue-500', badge: 'bg-blue-500/20 border-blue-500/40', badgeText: 'text-blue-400' },
  queued: { dot: 'bg-yellow-500', bar: 'bg-yellow-500', badge: 'bg-yellow-500/20 border-yellow-500/40', badgeText: 'text-yellow-400' },
  completed: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', badge: 'bg-emerald-500/20 border-emerald-500/40', badgeText: 'text-emerald-400' },
  failed: { dot: 'bg-red-500', bar: 'bg-red-500', badge: 'bg-red-500/20 border-red-500/40', badgeText: 'text-red-400' },
  stale: { dot: 'bg-zinc-600', bar: 'bg-zinc-600', badge: 'bg-zinc-600/20 border-zinc-600/40', badgeText: 'text-zinc-400' },
}

function timeAgo(date: string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

export function MissionBoardOverlay({ missions, open, onClose }: MissionBoardOverlayProps) {
  const [stepCounts, setStepCounts] = useState<Record<string, StepCounts>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

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

  // Group missions by status
  const grouped = STATUS_ORDER.reduce((acc, status) => {
    const group = missions.filter(m => m.status === status)
    if (group.length > 0) acc.push({ status, missions: group })
    return acc
  }, [] as { status: string; missions: Mission[] }[])

  const toggleGroup = (status: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-xl font-bold font-[family-name:var(--font-space-grotesk)]">
            Mission Board
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Mission list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {grouped.length === 0 && (
            <p className="text-sm text-zinc-600 font-[family-name:var(--font-jetbrains-mono)] text-center py-8">
              No missions yet
            </p>
          )}

          {grouped.map(({ status, missions: group }) => {
            const colors = STATUS_COLORS[status] ?? STATUS_COLORS.stale
            const isCollapsed = collapsedGroups.has(status)

            return (
              <div key={status}>
                <button
                  onClick={() => toggleGroup(status)}
                  className="flex items-center gap-2 mb-3 group cursor-pointer"
                >
                  <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">
                    {isCollapsed ? '▸' : '▾'}
                  </span>
                  <h3 className="text-sm font-[family-name:var(--font-space-grotesk)] font-semibold capitalize text-zinc-300">
                    {status}
                  </h3>
                  <span className="text-xs text-zinc-500 font-[family-name:var(--font-jetbrains-mono)] tabular-nums">
                    ({group.length})
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-2">
                    {group.map((mission) => {
                      const sc = stepCounts[mission.id]
                      const progress = sc && sc.total > 0 ? (sc.completed / sc.total) * 100 : 0

                      return (
                        <div
                          key={mission.id}
                          className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <p className="text-sm font-medium text-pretty line-clamp-2">
                              {mission.title}
                            </p>
                            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-[family-name:var(--font-jetbrains-mono)] font-medium border capitalize ${colors.badge} ${colors.badgeText}`}>
                              {status}
                            </span>
                          </div>

                          {/* Progress bar */}
                          {sc && sc.total > 0 && (
                            <div className="mb-2">
                              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-xs text-zinc-500 font-[family-name:var(--font-jetbrains-mono)] tabular-nums">
                            <span>{mission.assigned_to}</span>
                            <span className="text-zinc-700">·</span>
                            {sc ? (
                              <span>{sc.completed}/{sc.total} steps</span>
                            ) : (
                              <span>0 steps</span>
                            )}
                            <span className="text-zinc-700">·</span>
                            <span>{timeAgo(mission.created_at)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
