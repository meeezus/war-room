"use client"

import Image from 'next/image'
import Link from 'next/link'
import type { AgentStatus, RpgStats, RoleCard } from '@/lib/types'

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

interface AgentStatPopupProps {
  agent: AgentStatus
  stats: RpgStats
  roleCard: RoleCard
  position: { x: number; y: number }
  onClose: () => void
}

const STAT_LABELS = ['TRU', 'SPD', 'WIS', 'PWR'] as const

export function AgentStatPopup({ agent, stats, roleCard, position, onClose }: AgentStatPopupProps) {
  const avatar = AGENT_AVATARS[roleCard.id] || AGENT_AVATARS[roleCard.name.toLowerCase()] || '/agents/cc.png'

  return (
    <>
      {/* Backdrop to catch clicks away */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {/* Popup card */}
      <div
        className="absolute z-40 w-[220px] bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg p-4 shadow-lg shadow-black/30"
        style={{
          left: `${position.x + 40}px`,
          top: `${position.y - 60}px`,
        }}
      >
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 overflow-hidden rounded-full shrink-0">
              <Image
                src={avatar}
                alt={roleCard.name}
                width={32}
                height={32}
                className="size-full object-cover"
              />
            </div>
            <span className="font-[family-name:var(--font-space-grotesk)] font-semibold text-zinc-100">
              {roleCard.name}
            </span>
          </div>
          <div className="text-xs text-zinc-400 font-[family-name:var(--font-jetbrains-mono)]">
            {roleCard.title} · Lv.{stats.level}
          </div>
          <div className="text-[10px] text-zinc-500 font-[family-name:var(--font-jetbrains-mono)]">
            {roleCard.class}
          </div>
        </div>

        {/* Stat bars */}
        <div className="space-y-1.5 mb-3">
          {STAT_LABELS.map((stat) => (
            <div key={stat} className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-zinc-400 w-7 shrink-0">
                {stat}
              </span>
              <div className="flex-1 bg-zinc-800 rounded-full h-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(stats[stat] / 99) * 100}%`,
                    backgroundColor: roleCard.color,
                  }}
                />
              </div>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-zinc-300 tabular-nums w-5 text-right shrink-0">
                {stats[stat]}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] font-[family-name:var(--font-jetbrains-mono)] text-zinc-500 mb-2">
          <span>XP: {stats.totalXP}</span>
          <span className="capitalize">Status: {agent.status}</span>
        </div>

        {/* View Sheet link */}
        <Link
          href={`/agents/${agent.id}`}
          className="text-xs text-emerald-400 hover:text-emerald-300 font-[family-name:var(--font-jetbrains-mono)] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          View Sheet →
        </Link>
      </div>
    </>
  )
}
