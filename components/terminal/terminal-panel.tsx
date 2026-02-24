'use client'

import { useState } from 'react'
import type { Mission } from '@/lib/types'
import { InlineTerminal } from './inline-terminal'

interface TerminalPanelProps {
  missions: Mission[]
}

export function TerminalPanel({ missions }: TerminalPanelProps) {
  const runningMissions = missions.filter((m) => m.status === 'running')
  const [collapsed, setCollapsed] = useState(false)
  const [selectedId, setSelectedId] = useState<string>(
    runningMissions[0]?.id ?? ''
  )

  // Nothing to show
  if (runningMissions.length === 0) return null

  const activeMission =
    runningMissions.find((m) => m.id === selectedId) ?? runningMissions[0]

  return (
    <div className="flex-shrink-0 border-t border-border bg-card">
      {/* Panel header / collapse bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border bg-muted/50">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground/70 transition-colors"
          aria-label={collapsed ? 'Expand terminal' : 'Collapse terminal'}
        >
          <span
            className="inline-block text-[10px] transition-transform duration-150"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            &#9660;
          </span>
          <span
            className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider"
          >
            Terminal
          </span>
        </button>

        {/* Mission selector — only when multiple missions are running */}
        {runningMissions.length > 1 && !collapsed && (
          <div className="flex items-center gap-1 ml-2">
            {runningMissions.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`px-2 py-0.5 rounded-sm text-xs font-[family-name:var(--font-jetbrains-mono)] transition-colors truncate max-w-[160px] ${
                  m.id === activeMission.id
                    ? 'bg-accent text-foreground/70'
                    : 'text-muted-foreground/75 hover:text-muted-foreground'
                }`}
                title={m.title}
              >
                {m.title}
              </button>
            ))}
          </div>
        )}

        {/* Single mission title when not selecting */}
        {runningMissions.length === 1 && !collapsed && (
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground/75 truncate max-w-xs">
            {activeMission.title}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1 text-xs text-green-400/70 font-[family-name:var(--font-jetbrains-mono)]">
          <span className="animate-pulse">&#9679;</span>
          <span>{runningMissions.length} running</span>
        </span>
      </div>

      {/* Stream content */}
      {!collapsed && (
        <div className="h-48 overflow-hidden">
          <InlineTerminal
            key={activeMission.id}
            streamUrl={`/api/missions/${activeMission.id}/stream`}
          />
        </div>
      )}
    </div>
  )
}
