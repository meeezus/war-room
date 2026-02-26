# Realtime Subscription Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent unbounded Supabase realtime channel accumulation in `app/chat/page.tsx` by introducing a subscription manager with channel deduplication, a max-connection guard, and exponential backoff on channel errors.

**Architecture:** A singleton `SubscriptionManager` class in `lib/realtime-manager.ts` wraps the Supabase client's channel API. A `useChannel` React hook in `hooks/use-channel.ts` makes the manager ergonomic for components. `app/chat/page.tsx` migrates both of its raw `supabase.channel()` calls to use the hook. `lib/realtime.ts` is left untouched (its 9 channels are static/mount-once, lower risk — defer migration).

**Tech Stack:** TypeScript, `@supabase/supabase-js` v2, React 19, Vitest + jsdom for tests

---

## Context

### What exists today

`app/chat/page.tsx` (`ChatPage`) creates two Supabase realtime channels:

1. **`chat-messages-{threadId}`** — created/destroyed on `activeThreadId` change via `useEffect([activeThreadId])`. `channelRef.current` tracks it. Cleanup present.
2. **`chat-threads-updates`** — created once on mount. Cleanup present.

`lib/realtime.ts` creates 9 additional static channels on mount of whatever page uses those hooks. No centralized registry.

### What's missing

| Gap | Risk |
|-----|------|
| No channel deduplication | Rapid thread switching can momentarily create 2 `chat-messages-*` channels |
| No max-connection guard | Supabase JS client supports ≤10 concurrent realtime channels per client |
| No channel-error retry | If subscribe returns `CHANNEL_ERROR`, the channel dies silently |
| No observability | No way to see current channel count without reading code |

### What we're NOT doing

- Migrating `lib/realtime.ts` hooks — defer, lower risk
- Rate limiting subscribe calls — not needed at current scale
- Moving to WebSocket-level monitoring — over-engineered for this problem

---

## File Inventory

| File | Action | Note |
|------|--------|-------|
| `lib/realtime-manager.ts` | **Create** | Singleton SubscriptionManager + exports |
| `hooks/use-channel.ts` | **Create** | useChannel React hook |
| `app/chat/page.tsx` | **Modify** | Replace raw supabase.channel() with useChannel |
| `tests/realtime-manager.test.ts` | **Create** | Unit tests for SubscriptionManager |
| `tests/use-channel.test.ts` | **Create** | Unit tests for useChannel hook |

---

## Tasks

---

### Task 1: SubscriptionManager — failing tests

**Files:**
- Create: `tests/realtime-manager.test.ts`

**Step 1: Create the test file**

```typescript
// tests/realtime-manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SubscriptionManager } from '@/lib/realtime-manager'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

// Minimal mock for a RealtimeChannel
function makeChannel(name: string): RealtimeChannel {
  return {
    topic: name,
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  } as unknown as RealtimeChannel
}

// Minimal mock for the Supabase client
function makeSupabase(maxChannels = 10) {
  const channels: RealtimeChannel[] = []
  return {
    channel: vi.fn((name: string) => {
      const ch = makeChannel(name)
      channels.push(ch)
      return ch
    }),
    removeChannel: vi.fn(async (ch: RealtimeChannel) => {
      const idx = channels.indexOf(ch)
      if (idx !== -1) channels.splice(idx, 1)
    }),
    _channels: channels,
  } as unknown as SupabaseClient & { _channels: RealtimeChannel[] }
}

describe('SubscriptionManager', () => {
  let client: ReturnType<typeof makeSupabase>
  let manager: SubscriptionManager

  beforeEach(() => {
    client = makeSupabase()
    manager = new SubscriptionManager(client, { maxChannels: 3 })
  })

  it('registers a new channel and returns it', () => {
    const ch = manager.subscribe('test-channel', (c) => c.subscribe())
    expect(ch).toBeDefined()
    expect(manager.channelCount).toBe(1)
  })

  it('returns the existing channel if the name is already registered', () => {
    const ch1 = manager.subscribe('dupe', (c) => c.subscribe())
    const ch2 = manager.subscribe('dupe', (c) => c.subscribe())
    expect(ch1).toBe(ch2)
    expect(manager.channelCount).toBe(1)
    // supabase.channel() should only have been called once
    expect(client.channel).toHaveBeenCalledTimes(1)
  })

  it('throws when max channel limit is reached', () => {
    manager.subscribe('ch-1', (c) => c.subscribe())
    manager.subscribe('ch-2', (c) => c.subscribe())
    manager.subscribe('ch-3', (c) => c.subscribe())
    expect(() => manager.subscribe('ch-4', (c) => c.subscribe())).toThrow(
      /max channel limit/i
    )
  })

  it('unsubscribes and removes a channel from the registry', async () => {
    manager.subscribe('removable', (c) => c.subscribe())
    expect(manager.channelCount).toBe(1)
    await manager.unsubscribe('removable')
    expect(manager.channelCount).toBe(0)
    expect(client.removeChannel).toHaveBeenCalledTimes(1)
  })

  it('does nothing when unsubscribing a name that does not exist', async () => {
    await expect(manager.unsubscribe('ghost')).resolves.toBeUndefined()
    expect(client.removeChannel).not.toHaveBeenCalled()
  })

  it('reports channel names', () => {
    manager.subscribe('alpha', (c) => c.subscribe())
    manager.subscribe('beta', (c) => c.subscribe())
    expect(manager.channelNames).toEqual(expect.arrayContaining(['alpha', 'beta']))
  })

  it('allows resubscribe after unsubscribe on the same name', async () => {
    manager.subscribe('reuse', (c) => c.subscribe())
    await manager.unsubscribe('reuse')
    manager.subscribe('reuse', (c) => c.subscribe())
    expect(manager.channelCount).toBe(1)
    expect(client.channel).toHaveBeenCalledTimes(2)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/michaelenriquez/Code/war-room
npx vitest run tests/realtime-manager.test.ts 2>&1 | head -30
```

Expected: FAIL with "Cannot find module '@/lib/realtime-manager'"

**Step 3: Commit the failing test**

```bash
cd /Users/michaelenriquez/Code/war-room
git add tests/realtime-manager.test.ts
git commit -m "test: add failing tests for SubscriptionManager"
```

---

### Task 2: SubscriptionManager — implementation

**Files:**
- Create: `lib/realtime-manager.ts`

**Step 1: Create the implementation**

```typescript
// lib/realtime-manager.ts
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

export interface SubscriptionManagerOptions {
  /** Hard ceiling on simultaneous channels. Supabase JS default is 10. */
  maxChannels?: number
}

export class SubscriptionManager {
  private registry = new Map<string, RealtimeChannel>()
  private readonly client: SupabaseClient
  private readonly maxChannels: number

  constructor(client: SupabaseClient, options: SubscriptionManagerOptions = {}) {
    this.client = client
    this.maxChannels = options.maxChannels ?? 10
  }

  /**
   * Subscribe to a named channel. If a channel with this name is already
   * registered, the existing channel is returned (deduplication).
   *
   * @param name    Unique channel name (e.g. "chat-messages-{threadId}")
   * @param setup   Callback that receives a fresh RealtimeChannel and must
   *                call .subscribe() (and .on() etc.) before returning it.
   *                Not called when deduplicating.
   */
  subscribe(
    name: string,
    setup: (channel: RealtimeChannel) => RealtimeChannel
  ): RealtimeChannel {
    // Deduplication — return existing if already registered
    const existing = this.registry.get(name)
    if (existing) return existing

    // Enforce max connection limit
    if (this.registry.size >= this.maxChannels) {
      throw new Error(
        `SubscriptionManager: max channel limit (${this.maxChannels}) reached. ` +
        `Active channels: [${this.channelNames.join(', ')}]`
      )
    }

    const raw = this.client.channel(name)
    const configured = setup(raw)
    this.registry.set(name, configured)
    return configured
  }

  /**
   * Unsubscribe and remove a named channel from the registry.
   * No-op if the channel name is not registered.
   */
  async unsubscribe(name: string): Promise<void> {
    const channel = this.registry.get(name)
    if (!channel) return
    this.registry.delete(name)
    await this.client.removeChannel(channel)
  }

  /** Number of currently active channels. */
  get channelCount(): number {
    return this.registry.size
  }

  /** Names of currently active channels. */
  get channelNames(): string[] {
    return Array.from(this.registry.keys())
  }
}

// ---------------------------------------------------------------------------
// Singleton — shared across all components that import from this module.
// Initialized lazily because supabase client may be null during SSR.
// ---------------------------------------------------------------------------

let _manager: SubscriptionManager | null = null

export function getSubscriptionManager(
  client: NonNullable<import('@/lib/supabase').supabase>,
  options?: SubscriptionManagerOptions
): SubscriptionManager {
  if (!_manager) {
    _manager = new SubscriptionManager(client, options)
  }
  return _manager
}

/** For testing only — resets the singleton. */
export function _resetSubscriptionManager(): void {
  _manager = null
}
```

**Step 2: Run tests**

```bash
cd /Users/michaelenriquez/Code/war-room
npx vitest run tests/realtime-manager.test.ts 2>&1
```

Expected: All 7 tests PASS

**Step 3: Verify build**

```bash
cd /Users/michaelenriquez/Code/war-room
npm run build 2>&1 | tail -20
```

Expected: No TypeScript errors from new file.

**Step 4: Commit**

```bash
cd /Users/michaelenriquez/Code/war-room
git add lib/realtime-manager.ts
git commit -m "feat: add SubscriptionManager with deduplication and max-channel guard"
```

---

### Task 3: useChannel hook — failing tests

**Files:**
- Create: `tests/use-channel.test.ts`

**Step 1: Create test file**

```typescript
// tests/use-channel.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Mock the supabase module before importing the hook
vi.mock('@/lib/supabase', () => ({
  supabase: null, // default: null, overridden per-test
}))

// Mock the manager module
vi.mock('@/lib/realtime-manager', () => {
  const subscribeMock = vi.fn()
  const unsubscribeMock = vi.fn().mockResolvedValue(undefined)
  const getManagerMock = vi.fn(() => ({
    subscribe: subscribeMock,
    unsubscribe: unsubscribeMock,
    channelCount: 0,
    channelNames: [],
  }))
  return {
    getSubscriptionManager: getManagerMock,
    _subscribeMock: subscribeMock,
    _unsubscribeMock: unsubscribeMock,
  }
})

import { useChannel } from '@/hooks/use-channel'
import * as realtimeManager from '@/lib/realtime-manager'
import * as supabaseModule from '@/lib/supabase'

function makeChannel(name: string): RealtimeChannel {
  return {
    topic: name,
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
  } as unknown as RealtimeChannel
}

describe('useChannel', () => {
  const subscribeMock = (realtimeManager as any)._subscribeMock as ReturnType<typeof vi.fn>
  const unsubscribeMock = (realtimeManager as any)._unsubscribeMock as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    // Provide a fake supabase client
    ;(supabaseModule as any).supabase = { channel: vi.fn() }
    subscribeMock.mockImplementation((name: string, setup: Function) =>
      setup(makeChannel(name))
    )
  })

  afterEach(() => {
    ;(supabaseModule as any).supabase = null
  })

  it('calls subscribe on mount with the given channel name', () => {
    const setup = vi.fn((ch: RealtimeChannel) => ch)
    renderHook(() => useChannel('my-channel', setup))
    expect(subscribeMock).toHaveBeenCalledWith('my-channel', setup)
  })

  it('calls unsubscribe on unmount', async () => {
    const setup = vi.fn((ch: RealtimeChannel) => ch)
    const { unmount } = renderHook(() => useChannel('unmount-test', setup))
    unmount()
    // unsubscribe is async, wait a tick
    await act(async () => {})
    expect(unsubscribeMock).toHaveBeenCalledWith('unmount-test')
  })

  it('re-subscribes when the channel name changes', async () => {
    const setup = vi.fn((ch: RealtimeChannel) => ch)
    const { rerender } = renderHook(
      ({ name }: { name: string }) => useChannel(name, setup),
      { initialProps: { name: 'chan-a' } }
    )
    expect(subscribeMock).toHaveBeenCalledWith('chan-a', setup)

    await act(async () => {
      rerender({ name: 'chan-b' })
    })
    expect(unsubscribeMock).toHaveBeenCalledWith('chan-a')
    expect(subscribeMock).toHaveBeenCalledWith('chan-b', setup)
  })

  it('does nothing when supabase is null', () => {
    ;(supabaseModule as any).supabase = null
    const setup = vi.fn((ch: RealtimeChannel) => ch)
    renderHook(() => useChannel('null-client', setup))
    expect(subscribeMock).not.toHaveBeenCalled()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/michaelenriquez/Code/war-room
npx vitest run tests/use-channel.test.ts 2>&1 | head -30
```

Expected: FAIL with "Cannot find module '@/hooks/use-channel'"

**Step 3: Commit failing test**

```bash
cd /Users/michaelenriquez/Code/war-room
git add tests/use-channel.test.ts
git commit -m "test: add failing tests for useChannel hook"
```

---

### Task 4: useChannel hook — implementation

**Files:**
- Create: `hooks/use-channel.ts`

**Step 1: Create the hook**

```typescript
// hooks/use-channel.ts
"use client"

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getSubscriptionManager } from '@/lib/realtime-manager'

/**
 * useChannel
 *
 * Wraps SubscriptionManager for React components. Subscribes on mount,
 * unsubscribes on unmount or when `name` changes. Deduplicates channels
 * with the same name and enforces the global max-channel limit.
 *
 * @param name    Unique channel name. Changing this triggers re-subscribe.
 * @param setup   Callback to configure the RealtimeChannel (.on(), etc.)
 *                Must call .subscribe() and return the channel.
 *                Stable reference recommended (define outside component or
 *                wrap in useCallback).
 *
 * @example
 * useChannel(
 *   `chat-messages-${threadId}`,
 *   (ch) => ch
 *     .on('postgres_changes', { event: 'INSERT', ... }, handler)
 *     .subscribe()
 * )
 */
export function useChannel(
  name: string,
  setup: (channel: RealtimeChannel) => RealtimeChannel
): void {
  const nameRef = useRef(name)

  useEffect(() => {
    if (!supabase) return

    nameRef.current = name
    const manager = getSubscriptionManager(supabase)

    try {
      manager.subscribe(name, setup)
    } catch (err) {
      // Max channel limit hit — log and surface, don't crash the component
      console.error('[useChannel] Failed to subscribe:', err)
    }

    return () => {
      // Use nameRef so the cleanup captures the name at effect-run time
      manager.unsubscribe(nameRef.current).catch((err) => {
        console.error('[useChannel] Failed to unsubscribe:', err)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])
}
```

**Step 2: Run tests**

```bash
cd /Users/michaelenriquez/Code/war-room
npx vitest run tests/use-channel.test.ts 2>&1
```

Expected: All 4 tests PASS

**Step 3: Build check**

```bash
cd /Users/michaelenriquez/Code/war-room
npm run build 2>&1 | tail -20
```

Expected: Clean.

**Step 4: Commit**

```bash
cd /Users/michaelenriquez/Code/war-room
git add hooks/use-channel.ts
git commit -m "feat: add useChannel hook backed by SubscriptionManager"
```

---

### Task 5: Migrate chat/page.tsx

**Files:**
- Modify: `app/chat/page.tsx`

**Step 1: Read the current subscription blocks (for reference)**

Current code in `app/chat/page.tsx`, lines 27 and 35-100:
```typescript
// Line 27 — remove this:
const channelRef = useRef<RealtimeChannel | null>(null)

// Lines 35-79 — replace this entire useEffect:
useEffect(() => {
  if (!activeThreadId || !supabase) return
  if (channelRef.current) { supabase.removeChannel(channelRef.current) }
  const channel = supabase
    .channel(`chat-messages-${activeThreadId}`)
    .on('postgres_changes', { ... }, handler)
    .subscribe()
  channelRef.current = channel
  return () => {
    supabase?.removeChannel(channel)
    channelRef.current = null
  }
}, [activeThreadId])

// Lines 82-100 — replace this entire useEffect:
useEffect(() => {
  if (!supabase) return
  const channel = supabase
    .channel('chat-threads-updates')
    .on('postgres_changes', { ... }, fetchThreads)
    .subscribe()
  return () => { supabase?.removeChannel(channel) }
}, [])
```

**Step 2: Apply the migration**

Remove the `channelRef` declaration (line 27). Replace the two subscription `useEffect` blocks with `useChannel` calls. Also add the import at the top.

Add this import near the top of `app/chat/page.tsx` (after existing imports):
```typescript
import { useChannel } from '@/hooks/use-channel'
```

Remove:
```typescript
const channelRef = useRef<RealtimeChannel | null>(null)
```

Replace the messages subscription `useEffect` (lines 35-79):
```typescript
// Subscribe to Realtime for active thread messages
useChannel(
  activeThreadId ? `chat-messages-${activeThreadId}` : '',
  (channel) =>
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${activeThreadId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            const tempIdx = prev.findIndex(
              (m) =>
                m.id.startsWith('temp-') &&
                m.role === newMsg.role &&
                m.content === newMsg.content
            )
            if (tempIdx !== -1) {
              const updated = [...prev]
              updated[tempIdx] = newMsg
              return updated
            }
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()
)
```

Replace the thread list subscription `useEffect` (lines 82-100):
```typescript
// Subscribe to thread list updates
useChannel(
  'chat-threads-updates',
  (channel) =>
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_threads' },
        () => { fetchThreads() }
      )
      .subscribe()
)
```

Also remove the now-unused import (if `RealtimeChannel` is no longer used elsewhere in the file):
```typescript
// Remove from imports if no other usage:
import type { RealtimeChannel } from '@supabase/supabase-js'
```

**Step 3: Note on empty channel name**

When `activeThreadId` is null, we pass `''` as the channel name. The `useChannel` hook must guard against this. Add this guard at the top of the `useEffect` inside `useChannel`:

```typescript
// In hooks/use-channel.ts, inside the useEffect:
if (!supabase || !name) return
```

Update `hooks/use-channel.ts` to add `!name` guard:
```typescript
// Change:
if (!supabase) return
// To:
if (!supabase || !name) return
```

**Step 4: Build check**

```bash
cd /Users/michaelenriquez/Code/war-room
npm run build 2>&1 | tail -30
```

Expected: Clean build, no TypeScript errors.

**Step 5: Commit**

```bash
cd /Users/michaelenriquez/Code/war-room
git add app/chat/page.tsx hooks/use-channel.ts
git commit -m "refactor: migrate chat page to useChannel for deduplication + connection guard"
```

---

### Task 6: Run all tests + final verification

**Step 1: Run full test suite**

```bash
cd /Users/michaelenriquez/Code/war-room
npx vitest run tests/realtime-manager.test.ts tests/use-channel.test.ts 2>&1
```

Expected: 11 tests PASS (7 manager + 4 hook).

**Step 2: Final build**

```bash
cd /Users/michaelenriquez/Code/war-room
npm run build 2>&1 | tail -20
```

Expected: Clean.

**Step 3: Manual smoke test**

1. Open war-room chat page in browser
2. Switch threads 5+ times rapidly
3. Open Supabase dashboard → Realtime → confirm only 2 channels active (`chat-messages-{lastThreadId}` and `chat-threads-updates`)
4. Check browser console — no `[useChannel] Failed to subscribe` errors

**Step 4: Final commit**

```bash
cd /Users/michaelenriquez/Code/war-room
git add -A
git commit -m "chore: verify realtime subscription manager integration complete"
```

---

## Out of Scope (Defer)

| Item | Reason |
|------|--------|
| Migrate `lib/realtime.ts` hooks | 9 static channels, mount-once — lower risk, bigger surface area |
| WebSocket-level reconnect monitoring | Supabase SDK handles WS reconnect internally |
| Redis-backed connection tracking | Over-engineered for single-instance Next.js |
| Staging socket count monitoring | Set up after merge — needs Vercel environment access |

---

## Rollback

If something breaks after merge:

1. Revert `app/chat/page.tsx` to raw `supabase.channel()` pattern (restore `channelRef`, restore two `useEffect` blocks)
2. `lib/realtime-manager.ts` and `hooks/use-channel.ts` can remain — they're not imported by anything else
3. Git revert: `git revert HEAD~1` (just the migration commit)

---

## Verification

- [ ] `npx vitest run tests/realtime-manager.test.ts` — 7 passing
- [ ] `npx vitest run tests/use-channel.test.ts` — 4 passing
- [ ] `npm run build` — clean
- [ ] Manual: rapid thread switching, ≤2 active realtime channels in Supabase dashboard
- [ ] No console errors in chat page
