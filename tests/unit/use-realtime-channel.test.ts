import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// vi.hoisted ensures these run before the hoisted vi.mock factory
const { subscribeCallbacks, createdChannelNames, mockRemoveChannel } = vi.hoisted(() => ({
  subscribeCallbacks: new Map<string, (status: string) => void>(),
  createdChannelNames: [] as string[],
  mockRemoveChannel: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn().mockImplementation((name: string) => {
      createdChannelNames.push(name)
      const ch = {
        topic: name,
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((cb: (status: string) => void) => {
          subscribeCallbacks.set(name, cb)
          return ch
        }),
      }
      return ch
    }),
    removeChannel: mockRemoveChannel,
  },
}))

import {
  useRealtimeChannel,
  getRealtimeChannelCount,
  getRealtimeChannelNames,
  _resetRegistryForTesting,
} from '@/lib/use-realtime-channel'

describe('useRealtimeChannel', () => {
  beforeEach(() => {
    subscribeCallbacks.clear()
    createdChannelNames.length = 0
    mockRemoveChannel.mockClear()
    _resetRegistryForTesting()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllTimers()
  })

  // ---------------------------------------------------------------------------
  // Basic subscription
  // ---------------------------------------------------------------------------

  describe('basic subscription', () => {
    it('subscribes to channel when channelName is provided', () => {
      renderHook(() => useRealtimeChannel('test-channel', (ch) => ch))
      expect(createdChannelNames).toContain('test-channel')
    })

    it('calls setup function with the channel instance', () => {
      const setup = vi.fn().mockImplementation((ch) => ch)
      renderHook(() => useRealtimeChannel('setup-channel', setup))
      expect(setup).toHaveBeenCalledOnce()
    })

    it('does not subscribe when channelName is null', () => {
      renderHook(() => useRealtimeChannel(null, (ch) => ch))
      expect(createdChannelNames).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Registry management
  // ---------------------------------------------------------------------------

  describe('channel registry', () => {
    it('returns 0 channel count before any subscriptions', () => {
      expect(getRealtimeChannelCount()).toBe(0)
    })

    it('registers channel in registry after SUBSCRIBED status', () => {
      renderHook(() => useRealtimeChannel('reg-channel', (ch) => ch))
      expect(getRealtimeChannelCount()).toBe(0)

      act(() => {
        subscribeCallbacks.get('reg-channel')?.('SUBSCRIBED')
      })

      expect(getRealtimeChannelCount()).toBe(1)
      expect(getRealtimeChannelNames()).toContain('reg-channel')
    })

    it('removes channel from registry on unmount', () => {
      const { unmount } = renderHook(() =>
        useRealtimeChannel('cleanup-channel', (ch) => ch),
      )

      act(() => {
        subscribeCallbacks.get('cleanup-channel')?.('SUBSCRIBED')
      })
      expect(getRealtimeChannelCount()).toBe(1)

      unmount()
      expect(mockRemoveChannel).toHaveBeenCalledOnce()
      expect(getRealtimeChannelCount()).toBe(0)
    })

    it('does not increment count when channelName is null', () => {
      renderHook(() => useRealtimeChannel(null, (ch) => ch))
      expect(getRealtimeChannelCount()).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Re-subscription on channelName change
  // ---------------------------------------------------------------------------

  describe('re-subscription on channelName change', () => {
    it('removes old channel and creates new one when channelName changes', () => {
      const { rerender } = renderHook(
        ({ name }: { name: string | null }) => useRealtimeChannel(name, (ch) => ch),
        { initialProps: { name: 'channel-a' } as { name: string | null } },
      )

      act(() => {
        subscribeCallbacks.get('channel-a')?.('SUBSCRIBED')
      })
      expect(getRealtimeChannelCount()).toBe(1)

      rerender({ name: 'channel-b' })

      expect(mockRemoveChannel).toHaveBeenCalledOnce()
      expect(createdChannelNames).toContain('channel-b')
    })

    it('unregisters old channel from registry when channelName changes', () => {
      const { rerender } = renderHook(
        ({ name }: { name: string | null }) => useRealtimeChannel(name, (ch) => ch),
        { initialProps: { name: 'switch-a' } as { name: string | null } },
      )

      act(() => {
        subscribeCallbacks.get('switch-a')?.('SUBSCRIBED')
      })
      expect(getRealtimeChannelNames()).toContain('switch-a')

      rerender({ name: 'switch-b' })
      expect(getRealtimeChannelNames()).not.toContain('switch-a')
    })
  })

  // ---------------------------------------------------------------------------
  // Exponential backoff on errors
  // ---------------------------------------------------------------------------

  describe('exponential backoff', () => {
    it('retries after CHANNEL_ERROR without re-subscribing immediately', () => {
      renderHook(() => useRealtimeChannel('backoff-channel', (ch) => ch))
      const initialCount = createdChannelNames.length

      act(() => {
        subscribeCallbacks.get('backoff-channel')?.('CHANNEL_ERROR')
      })

      // Not retried immediately — delay required
      expect(createdChannelNames.length).toBe(initialCount)
    })

    it('retries after CHANNEL_ERROR once the backoff delay elapses', async () => {
      renderHook(() => useRealtimeChannel('backoff-channel', (ch) => ch))
      const initialCount = createdChannelNames.length

      act(() => {
        subscribeCallbacks.get('backoff-channel')?.('CHANNEL_ERROR')
      })

      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      expect(createdChannelNames.length).toBeGreaterThan(initialCount)
    })

    it('retries after TIMED_OUT status as well', async () => {
      renderHook(() => useRealtimeChannel('timeout-channel', (ch) => ch))
      const initialCount = createdChannelNames.length

      act(() => {
        subscribeCallbacks.get('timeout-channel')?.('TIMED_OUT')
      })

      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      expect(createdChannelNames.length).toBeGreaterThan(initialCount)
    })

    it('stops retrying after MAX_RETRIES (5) attempts', async () => {
      renderHook(() => useRealtimeChannel('max-retry-channel', (ch) => ch))

      // Trigger error + advance timers 7 times (more than MAX_RETRIES=5)
      for (let i = 0; i < 7; i++) {
        const cb = subscribeCallbacks.get('max-retry-channel')
        if (cb) act(() => cb('CHANNEL_ERROR'))
        await act(async () => {
          vi.advanceTimersByTime(30_000)
        })
      }

      // 1 initial + 5 retries = 6 max; subsequent errors should not create more
      const count = createdChannelNames.filter((n) => n === 'max-retry-channel').length
      expect(count).toBeLessThanOrEqual(6)
    })

    it('cancels pending retry timer on unmount', async () => {
      const { unmount } = renderHook(() =>
        useRealtimeChannel('cancel-retry-channel', (ch) => ch),
      )
      const initialCount = createdChannelNames.length

      act(() => {
        subscribeCallbacks.get('cancel-retry-channel')?.('CHANNEL_ERROR')
      })

      unmount()

      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })

      // No additional channels should be created after unmount
      expect(createdChannelNames.length).toBe(initialCount)
    })
  })

  // ---------------------------------------------------------------------------
  // Max channel enforcement
  // ---------------------------------------------------------------------------

  describe('max channel enforcement', () => {
    it('blocks subscription when MAX_CHANNELS (10) limit is reached', () => {
      // Fill registry with 10 channels
      for (let i = 0; i < 10; i++) {
        renderHook(() => useRealtimeChannel(`limit-channel-${i}`, (ch) => ch))
        act(() => {
          subscribeCallbacks.get(`limit-channel-${i}`)?.('SUBSCRIBED')
        })
      }
      expect(getRealtimeChannelCount()).toBe(10)

      // 11th channel should be blocked
      const countBefore = createdChannelNames.length
      renderHook(() => useRealtimeChannel('overflow-channel', (ch) => ch))
      expect(createdChannelNames.length).toBe(countBefore)
      expect(getRealtimeChannelCount()).toBe(10)
    })

    it('allows new subscription if an existing channel name is reused', () => {
      // Fill to 10
      for (let i = 0; i < 10; i++) {
        renderHook(() => useRealtimeChannel(`reuse-channel-${i}`, (ch) => ch))
        act(() => {
          subscribeCallbacks.get(`reuse-channel-${i}`)?.('SUBSCRIBED')
        })
      }

      // Re-subscribing to an existing channel name should not be blocked
      const countBefore = createdChannelNames.length
      renderHook(() => useRealtimeChannel('reuse-channel-0', (ch) => ch))
      // Channel is already in registry, so it proceeds
      expect(createdChannelNames.length).toBeGreaterThan(countBefore)
    })
  })
})
