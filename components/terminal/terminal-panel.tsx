'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Event } from '@/lib/types'

const MAX_EVENTS = 100
const REALTIME_ENABLED = process.env.NEXT_PUBLIC_ENABLE_REALTIME !== 'false'

// Color mapping by event type prefix/suffix
function getEventColor(eventType: string): string {
  if (eventType.endsWith('_failed')) return '#ef4444'       // red
  if (eventType === 'heartbeat') return '#4b5563'           // dim gray
  if (eventType.startsWith('proposal_')) return '#a855f7'  // purple/violet
  if (eventType.startsWith('mission_')) return '#3b82f6'   // blue
  if (eventType.startsWith('task_') || eventType.startsWith('step_')) return '#06b6d4' // cyan
  if (
    eventType.startsWith('patrol_') ||
    eventType.startsWith('discovery_')
  ) return '#f59e0b'                                        // amber
  if (eventType.startsWith('council_')) return '#22c55e'   // green
  if (
    eventType.startsWith('skill_') ||
    eventType === 'cross_pollination' ||
    eventType === 'daily_briefing' ||
    eventType === 'awareness_cycle_complete'
  ) return '#8b5cf6'                                        // violet
  return '#6b7280'                                          // default gray
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    const hh = d.getHours().toString().padStart(2, '0')
    const mm = d.getMinutes().toString().padStart(2, '0')
    const ss = d.getSeconds().toString().padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  } catch {
    return '--:--:--'
  }
}

interface BufferedEvent {
  id: string
  event: Event
}

export function TerminalPanel() {
  const [events, setEvents] = useState<BufferedEvent[]>([])
  const [paused, setPaused] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [connected, setConnected] = useState(false)
  const pauseBufferRef = useRef<BufferedEvent[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)

  // Keep ref in sync so the realtime callback always has current pause state
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  // Auto-scroll when not paused
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events, paused])

  const addEvent = useCallback((newEvent: Event) => {
    // Filter out heartbeats entirely — they're noise in the terminal
    if (newEvent.event_type === 'heartbeat') return

    const entry: BufferedEvent = { id: newEvent.id, event: newEvent }

    if (pausedRef.current) {
      // Buffer while paused; trim to avoid unbounded growth
      pauseBufferRef.current = [...pauseBufferRef.current, entry].slice(-MAX_EVENTS)
      return
    }

    setEvents((prev) => {
      const next = [...prev, entry]
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next
    })
  }, [])

  // Flush buffer on unpause
  const handlePauseToggle = useCallback(() => {
    setPaused((prev) => {
      if (prev) {
        // Resuming — flush buffered events
        const buffered = pauseBufferRef.current
        pauseBufferRef.current = []
        if (buffered.length > 0) {
          setEvents((existing) => {
            const combined = [...existing, ...buffered]
            return combined.length > MAX_EVENTS
              ? combined.slice(combined.length - MAX_EVENTS)
              : combined
          })
        }
      }
      return !prev
    })
  }, [])

  useEffect(() => {
    if (!REALTIME_ENABLED || !supabase) return

    const client = supabase
    const channel = client
      .channel('terminal-events-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'war_room_events' },
        (payload) => {
          addEvent(payload.new as Event)
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      client.removeChannel(channel)
      setConnected(false)
    }
  }, [addEvent])

  if (collapsed) {
    return (
      <div className="flex-shrink-0 border-t border-border" style={{ background: '#0a0a0a' }}>
        <div className="flex items-center gap-3 px-4 py-1.5">
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-1.5 transition-colors"
            style={{ color: '#4b5563' }}
            aria-label="Expand event stream"
          >
            <span
              className="inline-block text-[10px] transition-transform duration-150"
              style={{ transform: 'rotate(-90deg)' }}
            >
              &#9660;
            </span>
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              Live Event Stream
            </span>
          </button>
          <span
            className="ml-auto text-xs"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', color: '#4b5563' }}
          >
            {events.length} events
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex-shrink-0 border-t border-border flex flex-col"
      style={{ background: '#0a0a0a', height: '200px' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-1.5 border-b flex-shrink-0"
        style={{ borderColor: '#1f2937', background: '#111111' }}
      >
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center gap-1.5 transition-colors"
          style={{ color: '#4b5563' }}
          aria-label="Collapse event stream"
        >
          <span className="inline-block text-[10px]">&#9660;</span>
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            Live Event Stream
          </span>
        </button>

        {/* Connection indicator */}
        <div className="flex items-center gap-1">
          <span
            className={connected ? 'animate-pulse' : ''}
            style={{
              fontSize: '8px',
              color: connected ? '#22c55e' : '#4b5563',
            }}
          >
            &#9679;
          </span>
          <span
            className="text-xs"
            style={{
              fontFamily: 'var(--font-jetbrains-mono, monospace)',
              color: connected ? '#22c55e' : '#4b5563',
              opacity: 0.7,
            }}
          >
            {connected ? 'live' : 'disconnected'}
          </span>
        </div>

        {/* Event count */}
        <span
          className="text-xs"
          style={{
            fontFamily: 'var(--font-jetbrains-mono, monospace)',
            color: '#4b5563',
          }}
        >
          {events.length}/{MAX_EVENTS}
        </span>

        {/* Pause button */}
        <button
          onClick={handlePauseToggle}
          className="ml-auto text-xs px-2 py-0.5 rounded transition-colors"
          style={{
            fontFamily: 'var(--font-jetbrains-mono, monospace)',
            background: paused ? '#1f2937' : 'transparent',
            color: paused ? '#f59e0b' : '#4b5563',
            border: '1px solid',
            borderColor: paused ? '#374151' : '#1f2937',
          }}
          aria-label={paused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
        >
          {paused ? (
            <span>&#9654; resume {pauseBufferRef.current.length > 0 ? `(+${pauseBufferRef.current.length})` : ''}</span>
          ) : (
            <span>&#9646;&#9646; pause</span>
          )}
        </button>
      </div>

      {/* Event log */}
      <div
        className="flex-1 overflow-y-auto p-2 space-y-0.5"
        style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
      >
        {events.length === 0 ? (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: '#374151' }}
          >
            {connected ? 'waiting for events...' : 'no connection'}
          </div>
        ) : (
          events.map(({ id, event }) => {
            const color = getEventColor(event.event_type)
            return (
              <div key={id} className="flex items-baseline gap-2 text-xs leading-5">
                <span style={{ color: '#374151', flexShrink: 0 }}>
                  [{formatTime(event.created_at)}]
                </span>
                <span style={{ color, flexShrink: 0 }}>
                  {event.event_type}
                </span>
                {event.title && (
                  <span
                    className="truncate"
                    style={{ color: '#6b7280' }}
                    title={event.title}
                  >
                    {event.title}
                  </span>
                )}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
