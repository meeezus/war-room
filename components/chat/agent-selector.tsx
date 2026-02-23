"use client"

import { useEffect, useCallback } from 'react'

const SELECTABLE_AGENTS = [
  { id: 'cc', name: 'Claude Code', specialty: 'General' },
  { id: 'makima', name: 'Makima', specialty: 'Synthesis' },
  { id: 'ed', name: 'Ed', specialty: 'Engineering' },
  { id: 'light', name: 'Light', specialty: 'Strategy' },
  { id: 'major', name: 'Major', specialty: 'Operations' },
  { id: 'bulma', name: 'Bulma', specialty: 'Product' },
  { id: 'l', name: 'L', specialty: 'Analysis' },
  { id: 'nanami', name: 'Nanami', specialty: 'Finance' },
  { id: 'armin', name: 'Armin', specialty: 'Research' },
] as const

interface AgentSelectorProps {
  open: boolean
  onSelect: (agentId: string) => void
  onClose: () => void
}

export function AgentSelector({ open, onSelect, onClose }: AgentSelectorProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open, handleEscape])

  if (!open) return null

  return (
    <div
      data-testid="agent-selector-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        data-testid="agent-selector-modal"
        className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-base font-semibold text-zinc-200 font-[family-name:var(--font-space-grotesk)]">
          New conversation with...
        </h2>
        <div data-testid="agent-grid" className="grid grid-cols-3 gap-3">
          {SELECTABLE_AGENTS.map((agent) => (
            <button
              key={agent.id}
              data-testid={`agent-card-${agent.id}`}
              onClick={() => onSelect(agent.id)}
              className="flex flex-col items-center gap-1.5 rounded-lg p-3 transition-colors hover:bg-zinc-800 hover:ring-1 hover:ring-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              <img
                src={`/avatars/${agent.id}.webp`}
                alt={agent.name}
                className={`h-14 w-14 rounded-full object-cover ${
                  agent.id === 'cc' ? 'ring-2 ring-emerald-400' : ''
                }`}
              />
              <span className="text-sm text-zinc-200 font-[family-name:var(--font-space-grotesk)]">
                {agent.name}
              </span>
              <span className="text-[10px] text-zinc-500 font-[family-name:var(--font-jetbrains-mono)]">
                {agent.specialty}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
