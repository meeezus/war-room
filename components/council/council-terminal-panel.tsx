'use client'

import { useState } from 'react'
import { InlineTerminal } from '@/components/terminal/inline-terminal'

interface CouncilTerminalPanelProps {
  sessionId: string
  /** If true, the panel is visible immediately (e.g. session is actively running) */
  defaultOpen?: boolean
}

export function CouncilTerminalPanel({
  sessionId,
  defaultOpen = false,
}: CouncilTerminalPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [collapsed, setCollapsed] = useState(false)
  const [done, setDone] = useState(false)

  const streamUrl = `/api/council/${sessionId}/stream`

  if (!open) {
    return (
      <div className="mt-6 pt-6 border-t border-white/[0.06]">
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded-sm border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
        >
          &#9654; Show Execution Output
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6 border-t border-white/[0.06]">
      {/* Panel header / collapse bar */}
      <div className="flex items-center gap-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1.5 text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.7)] transition-colors"
          aria-label={collapsed ? 'Expand terminal' : 'Collapse terminal'}
        >
          <span
            className="inline-block text-[10px] transition-transform duration-150"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            &#9660;
          </span>
          <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider">
            Terminal
          </span>
        </button>

        <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-white/30 truncate max-w-xs">
          council execution
        </span>

        {!done && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-400/70 font-[family-name:var(--font-jetbrains-mono)]">
            <span className="animate-pulse">&#9679;</span>
            <span>live</span>
          </span>
        )}

        {done && (
          <span className="ml-auto text-xs text-white/30 font-[family-name:var(--font-jetbrains-mono)]">
            complete
          </span>
        )}
      </div>

      {/* Stream content */}
      {!collapsed && (
        <div className="mt-3">
          <InlineTerminal
            key={sessionId}
            streamUrl={streamUrl}
            onComplete={() => setDone(true)}
          />
        </div>
      )}
    </div>
  )
}
