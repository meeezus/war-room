'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { StreamEvent } from '@/lib/claude-stream-parser'
import { AgentSpawnCard } from './agent-spawn-card'
import { DiffViewer, isDiffContent } from './diff-viewer'

interface InlineTerminalProps {
  streamUrl: string
  inputUrl?: string
  onComplete?: () => void
}

type LocalEvent = StreamEvent | { type: 'user_input'; content: string }

interface LogEntry {
  id: number
  event: LocalEvent
}

type InputState = 'idle' | 'sending' | 'streaming'

let entryCounter = 0

function ToolLine({ event }: { event: Extract<StreamEvent, { type: 'tool_use' }> }) {
  const input = event.input as Record<string, unknown> | null
  const path =
    input && typeof input.path === 'string'
      ? input.path
      : input && typeof input.file_path === 'string'
        ? input.file_path
        : null

  return (
    <span className="text-amber-400">
      {'→ '}
      <span className="font-semibold">{event.tool}</span>
      {path && <span className="text-amber-300/70"> {path}</span>}
    </span>
  )
}

function CollapsibleToolResult({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  const toggle = useCallback(() => setExpanded((v) => !v), [])

  const hasDiff = isDiffContent(content)
  const firstLine = content.split('\n')[0] ?? ''
  const hasMore = content.includes('\n') || content.length > firstLine.length

  return (
    <button
      type="button"
      onClick={toggle}
      className="text-left w-full group"
      title={expanded ? 'Collapse' : 'Expand'}
    >
      {expanded ? (
        hasDiff ? (
          <div>
            <span className="text-white/20 mr-1 group-hover:text-white/40">▾</span>
            <DiffViewer content={content} />
          </div>
        ) : (
          <span className="text-white/40 whitespace-pre-wrap">
            <span className="text-white/20 mr-1 group-hover:text-white/40">▾</span>
            {content}
          </span>
        )
      ) : (
        <span className="text-white/40 whitespace-nowrap overflow-hidden block">
          <span className="text-white/20 mr-1 group-hover:text-white/40">▸</span>
          <span className="truncate inline-block max-w-[90%] align-bottom">
            {hasDiff ? 'diff' : firstLine}
          </span>
          {(hasMore || hasDiff) && <span className="text-white/20 ml-1">…</span>}
        </span>
      )}
    </button>
  )
}

function EventLine({ event }: { event: LocalEvent }) {
  switch (event.type) {
    case 'user_input':
      return (
        <span className="text-blue-300/80">
          <span className="text-blue-400/60 mr-1">{'>'}</span>
          {event.content}
        </span>
      )

    case 'text':
      return <span className="text-white/90 whitespace-pre-wrap">{event.content}</span>

    case 'tool_use':
      return <ToolLine event={event} />

    case 'tool_result':
      return <CollapsibleToolResult content={event.content} />

    case 'error':
      return <span className="text-red-400">{event.message}</span>

    case 'done':
      return (
        <span className="inline-flex items-center gap-1.5 text-green-400 font-semibold">
          <span>&#10003;</span>
          <span>Complete</span>
        </span>
      )

    case 'status':
      return <span className="text-white/30 italic">{event.message}</span>

    case 'agent_spawn':
      return <AgentSpawnCard event={event} status="spawning" />

    default:
      return null
  }
}

export function InlineTerminal({ streamUrl, inputUrl: inputUrlProp, onComplete }: InlineTerminalProps) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [active, setActive] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [inputState, setInputState] = useState<InputState>('idle')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Derive mission ID from streamUrl pattern: /api/missions/<id>/stream
  const missionId = streamUrl.match(/\/api\/missions\/([^/]+)\/stream/)?.[1] ?? null

  // Use explicit inputUrl prop, or derive from mission streamUrl
  const inputUrl = inputUrlProp ?? (missionId ? `/api/missions/${missionId}/input` : null)

  const addEntry = useCallback((event: LocalEvent) => {
    setEntries((prev) => [...prev, { id: entryCounter++, event }])
  }, [])

  useEffect(() => {
    const es = new EventSource(streamUrl)

    es.onmessage = (e: MessageEvent) => {
      let event: StreamEvent
      try {
        event = JSON.parse(e.data) as StreamEvent
      } catch {
        return
      }

      addEntry(event)

      if (event.type === 'done') {
        setActive(false)
        es.close()
        onComplete?.()
      }
    }

    es.onerror = () => {
      setActive(false)
      es.close()
    }

    return () => {
      es.close()
    }
  }, [streamUrl, onComplete, addEntry])

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  const sendInput = useCallback(async () => {
    const message = inputValue.trim()
    if (!message || !inputUrl || inputState !== 'idle') return

    setInputValue('')
    setInputState('sending')
    addEntry({ type: 'user_input', content: message })

    try {
      const res = await fetch(inputUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => 'Request failed')
        addEntry({ type: 'error', message: errText })
        setInputState('idle')
        return
      }

      setInputState('streaming')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const dataLine = part.split('\n').find((l) => l.startsWith('data: '))
          if (!dataLine) continue
          try {
            const event = JSON.parse(dataLine.slice(6)) as StreamEvent
            if (event.type !== 'done') {
              addEntry(event)
            }
          } catch {
            // ignore malformed
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      addEntry({ type: 'error', message })
    } finally {
      setInputState('idle')
      inputRef.current?.focus()
    }
  }, [inputValue, inputUrl, inputState, addEntry])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        void sendInput()
      }
    },
    [sendInput]
  )

  return (
    <div
      className="relative flex flex-col rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden"
      style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <span className="ml-2 text-xs text-white/30">stream</span>
        {active && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-400/70">
            <span className="animate-pulse">&#9679;</span>
            <span>live</span>
          </span>
        )}
        {inputState === 'streaming' && (
          <span className="ml-auto flex items-center gap-1 text-xs text-blue-400/70">
            <span className="animate-pulse">&#9679;</span>
            <span>responding</span>
          </span>
        )}
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto max-h-96 p-3 space-y-1 text-xs leading-relaxed">
        {entries.map(({ id, event }) => (
          <div key={id} className={event.type === 'agent_spawn' ? 'block' : 'flex'}>
            <EventLine event={event} />
          </div>
        ))}

        {/* Blinking cursor while active */}
        {active && (
          <div className="flex items-center">
            <span className="inline-block w-2 h-3.5 bg-white/60 animate-[blink_1s_step-end_infinite]" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar — shown when we can derive a mission ID */}
      {inputUrl && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.06] bg-white/[0.02]">
          <span className="text-xs text-white/30 select-none">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={inputState !== 'idle'}
            placeholder={active ? 'Send message to agent…' : 'Follow-up message…'}
            className="flex-1 bg-transparent text-xs text-white/80 placeholder:text-white/20 outline-none disabled:opacity-40"
          />
          <button
            type="button"
            onClick={() => void sendInput()}
            disabled={inputState !== 'idle' || !inputValue.trim()}
            className="text-xs text-white/30 hover:text-white/60 disabled:opacity-30 transition-colors px-1"
            aria-label="Send"
          >
            &#9166;
          </button>
        </div>
      )}
    </div>
  )
}
