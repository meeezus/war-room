"use client"

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { captureError, captureWarning } from '@/lib/sentry'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHANNELS = 10
const MAX_RETRIES = 5
const BASE_BACKOFF_MS = 1_000
const REALTIME_ENABLED = process.env.NEXT_PUBLIC_ENABLE_REALTIME !== 'false'

// ---------------------------------------------------------------------------
// Module-level registry — observability + enforcement
// Tracks active channels per browser tab (no cross-tab coordination needed)
// ---------------------------------------------------------------------------

const _registry = new Map<string, RealtimeChannel>()

/** Returns the number of currently active realtime subscriptions. */
export function getRealtimeChannelCount(): number {
  return _registry.size
}

/** Returns the names of all currently active realtime channels. */
export function getRealtimeChannelNames(): string[] {
  return Array.from(_registry.keys())
}

/** @internal — test-only reset. Do not call in production code. */
export function _resetRegistryForTesting(): void {
  _registry.clear()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChannelSetup = (channel: RealtimeChannel) => RealtimeChannel

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages a single Supabase realtime channel subscription with:
 * - Automatic cleanup on unmount or channelName change
 * - Exponential backoff reconnection on CHANNEL_ERROR / TIMED_OUT
 * - Global channel registry for observability
 * - MAX_CHANNELS enforcement to prevent unbounded socket connections
 *
 * @param channelName - Supabase channel topic name. Pass null to disable.
 * @param setup       - Callback that attaches .on() listeners to the channel.
 *                      Stored in a ref — changing this function between renders
 *                      will NOT trigger a re-subscription. Only `channelName`
 *                      drives re-subscription timing.
 *
 * @example
 * useRealtimeChannel(
 *   activeThreadId ? `chat-messages-${activeThreadId}` : null,
 *   (ch) => ch.on('postgres_changes', { event: 'INSERT', ... }, handler),
 * )
 */
export function useRealtimeChannel(
  channelName: string | null,
  setup: ChannelSetup,
): void {
  // Store setup in a ref so the effect doesn't re-run when the callback changes.
  // The latest version of setup will always be used when connecting.
  const setupRef = useRef<ChannelSetup>(setup)
  useEffect(() => {
    setupRef.current = setup
  })

  useEffect(() => {
    if (!channelName || !supabase || !REALTIME_ENABLED) return

    // Enforce max channel limit — only block if this is a NEW channel name
    if (!_registry.has(channelName) && _registry.size >= MAX_CHANNELS) {
      captureWarning(`[realtime] Max channels (${MAX_CHANNELS}) reached. Skipping subscription: ${channelName}`, { operation: 'useRealtimeChannel.maxChannels' })
      return
    }

    let channel: RealtimeChannel | null = null
    let retries = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    function connect() {
      if (cancelled || !supabase) return

      // Remove previous channel instance before reconnecting (retry path)
      if (channel) {
        supabase.removeChannel(channel)
        _registry.delete(channelName!)
        channel = null
      }

      const raw = supabase.channel(channelName!)
      channel = setupRef.current(raw)

      channel.subscribe((status: string) => {
        if (cancelled) return

        if (status === 'SUBSCRIBED') {
          retries = 0
          _registry.set(channelName!, channel!)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          _registry.delete(channelName!)

          if (retries >= MAX_RETRIES) {
            captureError(new Error(`[realtime] ${channelName}: max retries (${MAX_RETRIES}) exceeded — giving up`), 'realtime.maxRetries')
            return
          }

          // Exponential backoff with jitter: base * 2^n + rand(0..500ms)
          const backoff = BASE_BACKOFF_MS * Math.pow(2, retries) + Math.random() * 500
          retries++

          captureWarning(`[realtime] ${channelName}: ${status} — retry ${retries}/${MAX_RETRIES}`, { operation: 'useRealtimeChannel.retry' })

          retryTimer = setTimeout(connect, backoff)
        }
      })
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      if (channel && supabase) {
        supabase.removeChannel(channel)
        _registry.delete(channelName!)
        channel = null
      }
    }
    // Only re-subscribe when the channel name changes.
    // The setup function is intentionally excluded — it's kept current via setupRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName])
}
