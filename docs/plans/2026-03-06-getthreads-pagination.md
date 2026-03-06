# getThreads() Pagination Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a default limit of 50 + optional offset to `getThreads()` so dashboard page load time doesn't degrade as thread count grows.

**Architecture:** Add `limit` and `offset` params to `getThreads()` with sane defaults (50/0). Thread through to the API route via query params. No caching needed — Supabase Realtime already invalidates the thread list on every change.

**Tech Stack:** TypeScript, Supabase JS client (`.range()`), Next.js route handlers, Vitest

---

## Context

**The problem:**
- `getThreads()` in `lib/chat.ts:41-53` has no `.limit()` or `.range()` — it fetches every active thread
- `fetchThreads()` in `app/chat/page.tsx` is called on: mount, every Supabase Realtime `chat_threads` event, after send, after archive, delete, rename — i.e. very frequently
- As thread count grows, every one of these hits fetches the full table

**Secondary issue (out of scope, document only):**
- `cleanupArchivedThreads()` runs on every `GET /api/chat/threads` — including after every message send
- Should eventually be moved to a cron job; it's a write operation on every read request
- Not blocking, not part of this fix

**Why not cache?**
The page uses Supabase Realtime to subscribe to `chat_threads` changes and calls `fetchThreads()` on every event. A cache TTL would cause stale data to be shown immediately after a thread is created/renamed. The limit is sufficient to cap blast radius.

---

## File Inventory

| File | Action | Lines |
|------|---------|-------|
| `lib/chat.ts` | modify — add `limit`/`offset` params to `getThreads()` | 41–53 |
| `app/api/chat/threads/route.ts` | modify — parse + forward pagination params | 5–16 |
| `tests/unit/chat-lib-pagination.test.ts` | create — unit tests for `getThreads()` pagination | new |
| `tests/unit/chat-threads-route-pagination.test.ts` | create — unit tests for route param pass-through | new |

---

## Task 1: Add `limit` and `offset` to `getThreads()`

**Files:**
- Modify: `lib/chat.ts:41-53`
- Test: `tests/unit/chat-lib-pagination.test.ts`

### Step 1: Write the failing tests

Create `tests/unit/chat-lib-pagination.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Supabase mock (must be set up before import) ---
const mockRange = vi.fn().mockResolvedValue({ data: [], error: null })
const mockOrder = vi.fn(() => ({ range: mockRange }))
const mockEq = vi.fn(() => ({ order: mockOrder }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

// Stub env vars so getServiceClient() doesn't throw
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')

import { getThreads } from '@/lib/chat'

describe('getThreads() pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRange.mockResolvedValue({ data: [], error: null })
    // Re-wire the chain after clearAllMocks
    mockOrder.mockReturnValue({ range: mockRange })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('applies default limit of 50 (range 0–49)', async () => {
    await getThreads()
    expect(mockRange).toHaveBeenCalledWith(0, 49)
  })

  it('applies default offset of 0 with custom limit', async () => {
    await getThreads({ limit: 20 })
    expect(mockRange).toHaveBeenCalledWith(0, 19)
  })

  it('applies custom limit and offset', async () => {
    await getThreads({ limit: 20, offset: 40 })
    expect(mockRange).toHaveBeenCalledWith(40, 59)
  })

  it('defaults to active status when filter is omitted', async () => {
    await getThreads()
    expect(mockEq).toHaveBeenCalledWith('status', 'active')
  })

  it('passes archived status through', async () => {
    await getThreads({ status: 'archived' })
    expect(mockEq).toHaveBeenCalledWith('status', 'archived')
  })

  it('returns empty array when Supabase returns null data', async () => {
    mockRange.mockResolvedValue({ data: null, error: null })
    const result = await getThreads()
    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockRange.mockResolvedValue({ data: null, error: new Error('db error') })
    await expect(getThreads()).rejects.toThrow('db error')
  })
})
```

### Step 2: Run tests to confirm they fail

```bash
cd /Users/michaelenriquez/Code/war-room
npx vitest run tests/unit/chat-lib-pagination.test.ts
```

Expected: FAIL — `mockRange` not called because `.range()` doesn't exist yet on the query.

### Step 3: Implement the change in `lib/chat.ts`

Replace lines 41–53:

```typescript
export async function getThreads(
  filter?: { status?: 'active' | 'archived'; limit?: number; offset?: number }
): Promise<ChatThread[]> {
  const sb = getServiceClient()
  const status = filter?.status ?? 'active'
  const limit = filter?.limit ?? 50
  const offset = filter?.offset ?? 0
  const { data, error } = await sb
    .from('chat_threads')
    .select('*')
    .eq('status', status)
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return data ?? []
}
```

### Step 4: Run tests to confirm they pass

```bash
npx vitest run tests/unit/chat-lib-pagination.test.ts
```

Expected: All 7 tests PASS.

### Step 5: Commit

```bash
git add lib/chat.ts tests/unit/chat-lib-pagination.test.ts
git commit -m "fix: add default limit=50 and offset pagination to getThreads()"
```

---

## Task 2: Thread pagination params through the API route

**Files:**
- Modify: `app/api/chat/threads/route.ts:5-16`
- Test: `tests/unit/chat-threads-route-pagination.test.ts`

### Step 1: Write the failing tests

Create `tests/unit/chat-threads-route-pagination.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mocks ---
const mockGetThreads = vi.fn().mockResolvedValue([])
const mockCleanupArchivedThreads = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/chat', () => ({
  getThreads: (...args: unknown[]) => mockGetThreads(...args),
  cleanupArchivedThreads: (...args: unknown[]) => mockCleanupArchivedThreads(...args),
}))

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn(),
}))

import { GET } from '@/app/api/chat/threads/route'

describe('GET /api/chat/threads — pagination params', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes default limit=50 and offset=0 when not provided', async () => {
    const req = new NextRequest('http://localhost/api/chat/threads?status=active')
    await GET(req)
    expect(mockGetThreads).toHaveBeenCalledWith({ status: 'active', limit: 50, offset: 0 })
  })

  it('passes custom limit from query param', async () => {
    const req = new NextRequest('http://localhost/api/chat/threads?status=active&limit=20')
    await GET(req)
    expect(mockGetThreads).toHaveBeenCalledWith({ status: 'active', limit: 20, offset: 0 })
  })

  it('passes custom offset from query param', async () => {
    const req = new NextRequest('http://localhost/api/chat/threads?status=active&limit=20&offset=40')
    await GET(req)
    expect(mockGetThreads).toHaveBeenCalledWith({ status: 'active', limit: 20, offset: 40 })
  })

  it('clamps limit to max 200', async () => {
    const req = new NextRequest('http://localhost/api/chat/threads?limit=999')
    await GET(req)
    const call = mockGetThreads.mock.calls[0][0]
    expect(call.limit).toBe(200)
  })

  it('falls back to limit=50 for invalid limit param', async () => {
    const req = new NextRequest('http://localhost/api/chat/threads?limit=notanumber')
    await GET(req)
    const call = mockGetThreads.mock.calls[0][0]
    expect(call.limit).toBe(50)
  })

  it('falls back to offset=0 for negative offset', async () => {
    const req = new NextRequest('http://localhost/api/chat/threads?offset=-10')
    await GET(req)
    const call = mockGetThreads.mock.calls[0][0]
    expect(call.offset).toBe(0)
  })

  it('returns threads array in response', async () => {
    const mockThread = { id: 'thread-1', title: 'Test' }
    mockGetThreads.mockResolvedValue([mockThread])
    const req = new NextRequest('http://localhost/api/chat/threads')
    const res = await GET(req)
    const body = await res.json()
    expect(body.threads).toEqual([mockThread])
  })
})
```

### Step 2: Run tests to confirm they fail

```bash
npx vitest run tests/unit/chat-threads-route-pagination.test.ts
```

Expected: FAIL — route doesn't parse or forward limit/offset yet.

### Step 3: Implement the change in `app/api/chat/threads/route.ts`

Replace the `GET` handler (lines 5–16):

```typescript
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = (searchParams.get('status') as 'active' | 'archived') ?? 'active'
    const limitParam = Number(searchParams.get('limit') ?? '50')
    const offsetParam = Number(searchParams.get('offset') ?? '0')
    const limit = isNaN(limitParam) || limitParam < 1 ? 50 : Math.min(limitParam, 200)
    const offset = isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam
    await cleanupArchivedThreads()
    const threads = await getThreads({ status, limit, offset })
    return Response.json({ threads })
  } catch (err) {
    captureError(err, 'threads.GET', { route: '/api/chat/threads' })
    return Response.json({ error: 'Failed to fetch threads' }, { status: 500 })
  }
}
```

### Step 4: Run tests to confirm they pass

```bash
npx vitest run tests/unit/chat-threads-route-pagination.test.ts
```

Expected: All 7 tests PASS.

### Step 5: Run full test suite to confirm no regressions

```bash
npx vitest run
```

Expected: All tests PASS (no regressions in existing chat page tests).

### Step 6: Commit

```bash
git add app/api/chat/threads/route.ts tests/unit/chat-threads-route-pagination.test.ts
git commit -m "fix: thread pagination params through GET /api/chat/threads"
```

---

## Verification

- `npx vitest run` — all tests green
- `npm run build` — no TypeScript errors
- Manual: open `/chat`, confirm thread list loads. Archive a thread, confirm list updates via Realtime.
- Manual: `curl 'http://localhost:3000/api/chat/threads?status=active&limit=5'` — confirm only 5 threads returned

---

## Out of Scope (document only)

**`cleanupArchivedThreads()` on every GET:** This write operation runs on every call to `GET /api/chat/threads`, including after each message send. Should be moved to `/api/cron/jobs` on a daily schedule. Not urgent, not blocking.
