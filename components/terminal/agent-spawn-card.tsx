'use client'

import { useState } from 'react'
import type { StreamEvent } from '@/lib/claude-stream-parser'

type AgentSpawnEvent = Extract<StreamEvent, { type: 'agent_spawn' }>

/** Map common agent names to an icon character */
function agentIcon(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('scout')) return '◈'
  if (n.includes('oracle')) return '◉'
  if (n.includes('kraken')) return '⬡'
  if (n.includes('sleuth') || n.includes('debug')) return '⬡'
  if (n.includes('arbiter') || n.includes('validator')) return '◇'
  if (n.includes('spark')) return '◈'
  if (n.includes('pathfinder')) return '◎'
  return '▸'
}

/** Accent color class for the card border/glow per agent type */
function agentColor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('scout')) return 'cyan'
  if (n.includes('oracle')) return 'violet'
  if (n.includes('kraken')) return 'blue'
  if (n.includes('sleuth') || n.includes('debug')) return 'amber'
  if (n.includes('arbiter') || n.includes('validator')) return 'green'
  if (n.includes('spark')) return 'cyan'
  if (n.includes('pathfinder')) return 'sky'
  return 'cyan'
}

const COLOR_MAP: Record<string, { border: string; text: string; bg: string; glow: string }> = {
  cyan:   { border: 'border-cyan-500/30',   text: 'text-cyan-400',   bg: 'bg-cyan-500/10',   glow: '#06b6d4' },
  violet: { border: 'border-violet-500/30', text: 'text-violet-400', bg: 'bg-violet-500/10', glow: '#8b5cf6' },
  blue:   { border: 'border-blue-500/30',   text: 'text-blue-400',   bg: 'bg-blue-500/10',   glow: '#3b82f6' },
  amber:  { border: 'border-amber-500/30',  text: 'text-amber-400',  bg: 'bg-amber-500/10',  glow: '#f59e0b' },
  green:  { border: 'border-green-500/30',  text: 'text-green-400',  bg: 'bg-green-500/10',  glow: '#22c55e' },
  sky:    { border: 'border-sky-500/30',    text: 'text-sky-400',    bg: 'bg-sky-500/10',    glow: '#0ea5e9' },
}

export type AgentSpawnStatus = 'spawning' | 'running' | 'done' | 'error'

interface AgentSpawnCardProps {
  event: AgentSpawnEvent
  status?: AgentSpawnStatus
}

export function AgentSpawnCard({ event, status = 'spawning' }: AgentSpawnCardProps) {
  const [expanded, setExpanded] = useState(false)

  const colorKey = agentColor(event.name)
  const colors = COLOR_MAP[colorKey] ?? COLOR_MAP.cyan
  const icon = agentIcon(event.name)
  const taskPreview = event.task.slice(0, 160)
  const taskTruncated = event.task.length > 160

  const statusConfig = {
    spawning: { dot: 'bg-amber-400 animate-pulse', label: 'spawning' },
    running:  { dot: 'bg-cyan-400 animate-pulse',  label: 'running'  },
    done:     { dot: 'bg-green-400',               label: 'done'     },
    error:    { dot: 'bg-red-400',                 label: 'error'    },
  }[status]

  return (
    <div
      className={`rounded border ${colors.border} bg-[#0d0d0d] overflow-hidden`}
      style={{ boxShadow: `0 0 0 1px ${colors.glow}18, inset 0 0 12px ${colors.glow}08` }}
    >
      {/* Header row */}
      <div className={`flex items-center gap-2 px-2.5 py-1.5 ${colors.bg} border-b ${colors.border}`}>
        {/* Icon */}
        <span className={`text-sm font-bold ${colors.text}`}>{icon}</span>

        {/* Agent name */}
        <span className={`text-xs font-semibold ${colors.text} uppercase tracking-wider`}>
          {event.name}
        </span>

        {/* Status indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
          <span className="text-[10px] text-muted-foreground/75">{statusConfig.label}</span>
        </div>
      </div>

      {/* Task preview */}
      {event.task && (
        <div className="px-2.5 py-1.5">
          <p className={`text-[11px] leading-relaxed text-muted-foreground ${expanded ? '' : 'line-clamp-2'}`}>
            {taskPreview}
            {taskTruncated && !expanded && '…'}
          </p>
          {(taskTruncated || event.task.split('\n').length > 2) && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              {expanded ? 'collapse' : 'expand'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
