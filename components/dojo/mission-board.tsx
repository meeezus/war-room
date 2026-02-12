"use client"

import type { Mission } from '@/lib/types'

interface MissionBoardProps {
  missions: Mission[]
  position: { x: number; y: number }
  onExpand: () => void
}

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-blue-500',
  queued: 'bg-yellow-500',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
  stale: 'bg-zinc-600',
}

export function MissionBoard({ missions, position, onExpand }: MissionBoardProps) {
  const activeMissions = missions.filter(m => m.status === 'running' || m.status === 'queued')
  const runningMissions = missions.filter(m => m.status === 'running')
  const hasQueued = missions.some(m => m.status === 'queued')

  return (
    <div
      className="absolute cursor-pointer group"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
      onClick={(e) => {
        e.stopPropagation()
        onExpand()
      }}
    >
      <div className="relative flex flex-col items-center gap-2">
        {/* Board sprite */}
        <div className={`text-5xl select-none transition-transform group-hover:scale-110 ${hasQueued ? 'animate-pulse' : ''}`}>
          📋
        </div>

        {/* Mission count badge */}
        <div className={`px-3 py-1 rounded-full text-xs font-[family-name:var(--font-jetbrains-mono)] font-medium tabular-nums border transition-all ${
          hasQueued
            ? 'bg-emerald-600 text-white border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
        }`}>
          {activeMissions.length} Active
        </div>

        {/* Running mission progress dots */}
        {runningMissions.length > 0 && (
          <div className="flex gap-1">
            {runningMissions.slice(0, 6).map((m) => (
              <div
                key={m.id}
                className={`w-2 h-2 rounded-full ${STATUS_COLORS[m.status]} animate-pulse`}
                title={m.title}
              />
            ))}
            {runningMissions.length > 6 && (
              <span className="text-[10px] text-zinc-500 font-[family-name:var(--font-jetbrains-mono)]">
                +{runningMissions.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Hover hint */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/95 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-400 font-[family-name:var(--font-jetbrains-mono)]">
          View missions
        </div>
      </div>
    </div>
  )
}
