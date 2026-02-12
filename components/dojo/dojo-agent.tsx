"use client"

import Image from 'next/image'
import type { AgentStatus } from '@/lib/types'

interface DojoAgentProps {
  agent: AgentStatus
  position: { x: number; y: number }
  isNearby?: boolean
  ringColor?: string
  onClick?: (agent: AgentStatus, screenPos: { x: number; y: number }) => void
}

const AGENT_AVATARS: Record<string, string> = {
  'pip': '/agents/cc.png',
  'cc': '/agents/cc.png',
  'ed': '/agents/ed.png',
  'light': '/agents/light.png',
  'toji': '/agents/toji.png',
  'power': '/agents/makima.png',
  'makima': '/agents/makima.png',
  'major': '/agents/major.png',
}

const STATUS_COLORS: Record<AgentStatus['status'], string> = {
  online: '#10b981',
  idle: '#eab308',
  busy: '#ef4444',
  offline: '#6b7280',
}

export function DojoAgent({ agent, position, isNearby, ringColor, onClick }: DojoAgentProps) {
  const avatar = AGENT_AVATARS[agent.name.toLowerCase()] || '/agents/cc.png'
  const statusColor = ringColor || STATUS_COLORS[agent.status]
  const isBusy = agent.status === 'busy'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClick) {
      onClick(agent, { x: position.x, y: position.y })
    }
  }

  return (
    <div
      className="absolute cursor-pointer"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
      onClick={handleClick}
    >
      <div className="relative flex flex-col items-center gap-1">
        {/* Status ring with glow for busy agents */}
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: `3px solid ${statusColor}`,
              width: '54px',
              height: '54px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              boxShadow: isBusy ? `0 0 12px ${statusColor}` : 'none',
            }}
          />

          {/* Agent sprite */}
          <div className="relative size-12 z-10 overflow-hidden rounded-full">
            <Image
              src={avatar}
              alt={agent.display_name}
              width={48}
              height={48}
              className="size-full object-cover"
            />
          </div>

          {/* Work indicator */}
          {agent.current_mission_id && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-950 animate-pulse" />
          )}
        </div>

        {/* Agent info */}
        <div className="flex flex-col items-center gap-0.5 select-none">
          <div className="text-xs font-[family-name:var(--font-space-grotesk)] font-medium text-zinc-100">
            {agent.display_name}
          </div>
          <div className="text-[10px] font-[family-name:var(--font-jetbrains-mono)] text-zinc-500 tabular-nums">
            LVL {agent.level}
          </div>
        </div>

        {/* Nearby prompt */}
        {isNearby && (
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-900/95 border border-emerald-500/50 rounded px-2 py-1 text-xs text-emerald-400 font-[family-name:var(--font-jetbrains-mono)] animate-pulse">
            Press A to talk
          </div>
        )}

        {/* Shadow */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/30 rounded-full blur-sm" />
      </div>
    </div>
  )
}
