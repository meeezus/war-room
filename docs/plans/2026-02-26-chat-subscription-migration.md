# Chat Page Subscription Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate `app/chat/page.tsx` from manual Supabase channel management to the existing `useRealtimeChannel` hook, gaining exponential backoff, channel registry, and MAX_CHANNELS=10 enforcement for free.

**Architecture:** The `lib/use-realtime-channel.ts` hook already implements everything we need (backoff, jitter, registry, max limit). `page.tsx` is rolling its own manual subscription logic that bypasses all of it. This is a surgical refactor — no new infrastructure, just connect the existing wires.

**Tech Stack:** React 19, `@supabase/supabase-js ^2.95.3`, Vitest, `@testing-library/react`

---

## Context

### What exists in `lib/use-realtime-channel.ts` (DO NOT CHANGE)
- `MAX_CHANNELS = 10` — blocks new subscriptions when limit hit
- `MAX_RETRIES = 5` with exponential backoff: `1000 * 2^n + rand(0..500ms)`
- Module-level `_registry: Map<string, RealtimeChannel>` — tracks active channels
- `getRealtimeChannelCount()` / `getRealtimeChannelNames()` — observability exports
- `_resetRegistryForTesting()` — test-only registry reset

### What `page.tsx` does now (lines 44, 97-158)
```typescript
// line 44 — manual ref we'll delete
const channelRef = useRef<RealtimeChannel | null>(null)

// lines 97-138 — DM messages subscription (manual, no backoff)
useEffect(() => {
  if (!activeThreadId || !supabase) return
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current)  // manual guard
  }
  const channel = supabase.channel(`chat-messages-${activeThreadId}`)
    .on('postgres_changes', { event: 'INSERT', ... filter: `thread_id=eq.${activeThreadId}` }, handler)
    .subscribe()
  channelRef.current = channel
  return () => { supabase?.removeChannel(channel); channelRef.current = null }
}, [activeThreadId])

// lines 141-158 — thread list subscription (manual, no backoff)
useEffect(() => {
  if (!supabase) return
  const channel = supabase.channel('chat-threads-updates')
    .on('postgres_changes', { event: '*', table: 'chat_threads' }, () => fetchThreads())
    .subscribe()
  return () => { supabase?.removeChannel(channel) }
}, [])
```

### Target state after migration
```typescript
// channelRef GONE — hook manages lifecycle

useRealtimeChannel(
  activeThreadId ? `chat-messages-${activeThreadId}` : null,
  (ch) => ch.on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'chat_messages',
    filter: `thread_id=eq.${activeThreadId}`,
  }, handler)
)

useRealtimeChannel(
  'chat-threads-updates',
  (ch) => ch.on('postgres_changes', {
    event: '*', schema: 'public', table: 'chat_threads',
  }, () => fetchThreads())
)
```

### Why this is safe
- `setup` callback is stored in a ref inside `useRealtimeChannel` — the latest version always runs
- `activeThreadId` is embedded in the channel NAME, so when it changes, the hook re-subscribes automatically
- The manual `channelRef` guard (lines 100-102) was protecting against double-subscription on `activeThreadId` change — `useRealtimeChannel` handles this via effect dependency on `channelName`

---

## Task 1: Write Failing Tests for page.tsx Subscription Behavior

**Files:**
- Create: `tests/unit/chat-page-subscriptions.test.tsx`

**Step 1: Write the failing test file**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

// Same mock scaffold as use-realtime-channel.test.ts
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
        subscribe: vi.fn().mockImplementation((cb?: (status: string) => void) => {
          if (cb) subscribeCallbacks.set(name, cb)
          return ch
        }),
      }
      return ch
    }),
    removeChannel: mockRemoveChannel,
  },
}))

// Mock all data-fetching so ChatPage renders without Supabase queries
vi.mock('@/lib/chat', () => ({
  fetchChatThreads: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/channels', () => ({
  fetchCategories: vi.fn().mockResolvedValue([]),
  fetchChannels: vi.fn().mockResolvedValue([]),
  fetchChannelMessages: vi.fn().mockResolvedValue([]),
}))

import ChatPage from '@/app/chat/page'
import { _resetRegistryForTesting } from '@/lib/use-realtime-channel'

describe('ChatPage subscriptions', () => {
  beforeEach(() => {
    subscribeCallbacks.clear()
    createdChannelNames.length = 0
    mockRemoveChannel.mockClear()
    _resetRegistryForTesting()
  })

  it('subscribes to chat-threads-updates on mount', async () => {
    await act(async () => {
      render(<ChatPage />)
    })
    expect(createdChannelNames).toContain('chat-threads-updates')
  })

  it('does NOT subscribe to chat-messages-* when no thread is active', async () => {
    await act(async () => {
      render(<ChatPage />)
    })
    const messageChannels = createdChannelNames.filter((n) => n.startsWith('chat-messages-'))
    expect(messageChannels).toHaveLength(0)
  })

  it('cleans up chat-threads-updates on unmount', async () => {
    let unmount!: () => void
    await act(async () => {
      const result = render(<ChatPage />)
      unmount = result.unmount
    })
    act(() => { unmount() })
    expect(mockRemoveChannel).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'chat-threads-updates' })
    )
  })
})
```

**Step 2: Run test to verify it fails (for the right reasons)**

```bash
cd ~/Code/war-room && npx vitest run tests/unit/chat-page-subscriptions.test.tsx
```

Expected: FAIL — likely due to missing module mocks or component rendering issues. Adjust mocks until the three tests FAIL only because of the subscription assertions themselves (i.e., the component renders but doesn't use `useRealtimeChannel` yet).

**Step 3: Commit the test file**

```bash
cd ~/Code/war-room
git add tests/unit/chat-page-subscriptions.test.tsx
git commit -m "test: add failing tests for chat page subscription behavior"
```

---

## Task 2: Migrate DM Messages Subscription to `useRealtimeChannel`

**Files:**
- Modify: `app/chat/page.tsx:97-138` (manual DM messages subscription + channelRef)

**Step 1: Add the import**

In `app/chat/page.tsx`, find the existing imports at the top. Add `useRealtimeChannel` to the imports:

```typescript
// BEFORE (line 3):
import { useState, useEffect, useCallback, useRef } from 'react'

// AFTER:
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRealtimeChannel } from '@/lib/use-realtime-channel'
```

**Step 2: Extract the message handler (it stays the same)**

The handler inside the current subscription (lines 114-128) is:
```typescript
(payload) => {
  const newMsg = payload.new as ChatMessage
  setMessages((prev) => {
    if (prev.some((m) => m.id === newMsg.id)) return prev
    const tempIdx = prev.findIndex(
      (m) => m.id.startsWith('temp-') && m.role === newMsg.role && m.content === newMsg.content
    )
    if (tempIdx !== -1) {
      const updated = [...prev]
      updated[tempIdx] = newMsg
      return updated
    }
    return [...prev, newMsg]
  })
}
```

This handler is safe to inline in the `useRealtimeChannel` setup callback — `setMessages` is stable across renders.

**Step 3: Replace lines 96-138 entirely**

```typescript
// Subscribe to Realtime for active thread messages
useRealtimeChannel(
  activeThreadId ? `chat-messages-${activeThreadId}` : null,
  (ch) =>
    ch.on(
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
            (m) => m.id.startsWith('temp-') && m.role === newMsg.role && m.content === newMsg.content
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
)
```

**Step 4: Delete `channelRef` declaration (line 44)**

Remove this line entirely:
```typescript
const channelRef = useRef<RealtimeChannel | null>(null)
```

**Step 5: Run tests**

```bash
cd ~/Code/war-room && npx vitest run tests/unit/chat-page-subscriptions.test.tsx
```

Expected: The two DM-unrelated tests (`chat-threads-updates on mount`, `cleanup on unmount`) still pass or progress. The DM test (`no chat-messages-* when no thread active`) should now pass if component renders without activeThreadId.

**Step 6: Type-check**

```bash
cd ~/Code/war-room && npx tsc --noEmit
```

Expected: No errors. If `RealtimeChannel` import is now unused, TypeScript will warn — leave it for Task 4.

**Step 7: Commit**

```bash
cd ~/Code/war-room
git add app/chat/page.tsx
git commit -m "refactor: migrate DM messages subscription to useRealtimeChannel"
```

---

## Task 3: Migrate Thread List Subscription to `useRealtimeChannel`

**Files:**
- Modify: `app/chat/page.tsx:140-158` (manual thread list subscription)

**Step 1: Replace lines 140-158 entirely**

```typescript
// Subscribe to thread list updates
useRealtimeChannel(
  'chat-threads-updates',
  (ch) =>
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_threads' },
      () => { fetchThreads() }
    )
)
```

**Step 2: Run the full test suite**

```bash
cd ~/Code/war-room && npx vitest run tests/unit/chat-page-subscriptions.test.tsx
```

Expected: All 3 tests PASS.

**Step 3: Run the existing `useRealtimeChannel` tests to verify no regressions**

```bash
cd ~/Code/war-room && npx vitest run tests/unit/use-realtime-channel.test.ts
```

Expected: All tests PASS (we didn't touch that file).

**Step 4: Type-check**

```bash
cd ~/Code/war-room && npx tsc --noEmit
```

**Step 5: Commit**

```bash
cd ~/Code/war-room
git add app/chat/page.tsx
git commit -m "refactor: migrate thread list subscription to useRealtimeChannel"
```

---

## Task 4: Clean Up Dead Imports

**Files:**
- Modify: `app/chat/page.tsx:3,19` (imports)

**Step 1: Check if `useRef` is still used elsewhere in page.tsx**

```bash
grep -n "useRef" ~/Code/war-room/app/chat/page.tsx
```

If `useRef` appears ONLY in the deleted `channelRef` line (now gone), remove it from the React import. If it appears elsewhere, keep it.

**Step 2: Check if `RealtimeChannel` type is still used**

```bash
grep -n "RealtimeChannel" ~/Code/war-room/app/chat/page.tsx
```

If zero results, remove this line from page.tsx:
```typescript
import type { RealtimeChannel } from '@supabase/supabase-js'
```

**Step 3: Final type-check + lint**

```bash
cd ~/Code/war-room && npx tsc --noEmit && npx eslint app/chat/page.tsx --max-warnings 0
```

Expected: Clean output.

**Step 4: Run full test suite one final time**

```bash
cd ~/Code/war-room && npx vitest run
```

Expected: All tests pass, no regressions.

**Step 5: Commit**

```bash
cd ~/Code/war-room
git add app/chat/page.tsx
git commit -m "chore: remove dead channelRef and RealtimeChannel imports from chat page"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `grep -n "channelRef" ~/Code/war-room/app/chat/page.tsx` → 0 results
- [ ] `grep -n "useRealtimeChannel" ~/Code/war-room/app/chat/page.tsx` → 2 results
- [ ] `grep -n "supabase\.channel" ~/Code/war-room/app/chat/page.tsx` → 0 results

---

## What This Gives Us

| Concern | Before | After |
|---------|--------|-------|
| Backoff on error | None — dead socket stays dead | 5 retries, 1s→32s exponential + jitter |
| Max connection limit | Unbounded | Hard cap at 10 channels |
| Channel observability | None | `getRealtimeChannelCount()` / `getRealtimeChannelNames()` |
| Cleanup on thread change | Manual ref guard | Hook handles via effect dep |
| Code lines in page.tsx | ~25 lines subscription code | ~12 lines |

---

## Out of Scope

- **`lib/realtime.ts` domain hooks** — they also inline manual subscription logic but are lower risk (static channel names, not user-driven thread switches). Migrate separately if needed.
- **Cross-tab channel deduplication** — registry is per-tab (module scope). Not needed for current scale.
- **Socket connection monitoring in staging** — valid follow-up: log `getRealtimeChannelCount()` to a metrics endpoint. Out of scope for this PR.
