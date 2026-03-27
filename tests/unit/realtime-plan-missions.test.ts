import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Supabase mock — capture channel subscriptions and allow triggering payloads
// ---------------------------------------------------------------------------

type ChannelCallback = (payload: { new: unknown; old?: unknown; eventType?: string }) => void

const { channelCallbacks, createdChannels, mockRemoveChannel } = vi.hoisted(() => ({
  channelCallbacks: new Map<string, Map<string, (payload: { new: unknown; old?: unknown; eventType?: string }) => void>>(),
  createdChannels: { value: [] as string[] },
  mockRemoveChannel: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn().mockImplementation((name: string) => {
      createdChannels.value.push(name)
      const callbacks = new Map<string, (payload: { new: unknown; old?: unknown; eventType?: string }) => void>()
      channelCallbacks.set(name, callbacks)
      const ch = {
        topic: name,
        on: vi.fn().mockImplementation(
          (_type: string, opts: { event: string; table: string; filter?: string }, cb: (payload: { new: unknown; old?: unknown; eventType?: string }) => void) => {
            callbacks.set(`${opts.event}:${opts.table}`, cb)
            return ch
          },
        ),
        subscribe: vi.fn().mockReturnThis(),
      }
      return ch
    }),
    removeChannel: mockRemoveChannel,
  },
}))

import { useRealtimePlanMissions } from '@/lib/realtime'
import type { Mission } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'mission-1',
    proposal_id: null,
    project_id: null,
    plan_id: 'plan-abc',
    title: 'BEAD-001: Test mission',
    assigned_to: 'ed',
    status: 'queued',
    priority: 1,
    wave_index: 0,
    started_at: null,
    completed_at: null,
    result: null,
    evaluation_result: null,
    created_at: '2026-03-26T00:00:00Z',
    ...overrides,
  }
}

function triggerCallback(channelName: string, eventKey: string, payload: unknown) {
  const callbacks = channelCallbacks.get(channelName)
  if (!callbacks) throw new Error(`No channel: ${channelName}`)
  const cb = callbacks.get(eventKey)
  if (!cb) throw new Error(`No callback for ${eventKey} on ${channelName}. Available: ${Array.from(callbacks.keys()).join(', ')}`)
  cb(payload as Parameters<ChannelCallback>[0])
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRealtimePlanMissions', () => {
  beforeEach(() => {
    channelCallbacks.clear()
    createdChannels.value = []
    mockRemoveChannel.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  // ---- Initialization ----

  it('returns initialMissions on first render', () => {
    const initial = [makeMission()]
    const { result } = renderHook(() => useRealtimePlanMissions('plan-abc', initial))
    expect(result.current).toEqual(initial)
  })

  it('subscribes to the correct channel name based on planId', () => {
    renderHook(() => useRealtimePlanMissions('plan-xyz', []))
    expect(createdChannels.value).toContain('plan-missions-plan-xyz')
  })

  it('does not subscribe when planId is empty', () => {
    renderHook(() => useRealtimePlanMissions('', []))
    // Should not create any channel
    expect(createdChannels.value).toHaveLength(0)
  })

  // ---- INSERT handling ----

  it('prepends a new mission on INSERT', () => {
    const initial = [makeMission({ id: 'existing' })]
    const { result } = renderHook(() => useRealtimePlanMissions('plan-abc', initial))

    const newMission = makeMission({ id: 'new-one', title: 'BEAD-002: New' })
    act(() => {
      triggerCallback('plan-missions-plan-abc', 'INSERT:missions', { new: newMission })
    })

    expect(result.current).toHaveLength(2)
    expect(result.current[0].id).toBe('new-one')
    expect(result.current[1].id).toBe('existing')
  })

  // ---- UPDATE handling ----

  it('updates an existing mission on UPDATE', () => {
    const initial = [makeMission({ id: 'm1', status: 'queued' })]
    const { result } = renderHook(() => useRealtimePlanMissions('plan-abc', initial))

    const updated = makeMission({ id: 'm1', status: 'running' })
    act(() => {
      triggerCallback('plan-missions-plan-abc', 'UPDATE:missions', { new: updated })
    })

    expect(result.current).toHaveLength(1)
    expect(result.current[0].status).toBe('running')
  })

  it('does not duplicate on UPDATE for unknown mission id', () => {
    const initial = [makeMission({ id: 'm1' })]
    const { result } = renderHook(() => useRealtimePlanMissions('plan-abc', initial))

    const updated = makeMission({ id: 'unknown', status: 'completed' })
    act(() => {
      triggerCallback('plan-missions-plan-abc', 'UPDATE:missions', { new: updated })
    })

    // Should still have 1 mission — the unknown one wasn't found, so nothing changed
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('m1')
  })

  // ---- Cleanup ----

  it('removes channel on unmount', () => {
    const { unmount } = renderHook(() => useRealtimePlanMissions('plan-abc', []))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalled()
  })

  // ---- Re-sync on initialMissions change ----

  it('resets to new initialMissions when they change', () => {
    const initial1 = [makeMission({ id: 'a' })]
    const initial2 = [makeMission({ id: 'b' }), makeMission({ id: 'c' })]

    const { result, rerender } = renderHook(
      ({ missions }) => useRealtimePlanMissions('plan-abc', missions),
      { initialProps: { missions: initial1 } },
    )

    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('a')

    rerender({ missions: initial2 })

    expect(result.current).toHaveLength(2)
    expect(result.current[0].id).toBe('b')
  })
})
