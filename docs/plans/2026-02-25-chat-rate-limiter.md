# Chat Rate Limiter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent concurrent and high-frequency invocations of `claude -p` / OpenClaw by adding per-thread in-flight locking and per-thread request-rate limiting to `/app/api/chat/route.ts`.

**Architecture:** A lightweight, zero-dependency in-memory module (`lib/rate-limiter.ts`) tracks two things per `threadId`: (1) whether a request is currently in-flight (concurrent lock), and (2) how many requests have been made in the current 60-second sliding window (rate window). The chat route checks both at request entry and releases the lock when the stream closes or errors. No Redis, no external packages — this is a single-process Next.js app owned by one user.

**Tech Stack:** TypeScript, Next.js App Router, Vitest (existing), zero new dependencies.

---

## Why NOT the other suggestions

| Patrol suggestion | Decision | Reason |
|---|---|---|
| 50-100ms batching window | **Skip** | SSE streaming means each message is its own connection. Batching would add latency for zero benefit on a human-driven UI. Wrong abstraction. |
| Exponential backoff | **Skip (client concern)** | Server returns 429 + `Retry-After` header. Client already handles errors; backoff logic belongs there. |
| Makima session reuse | **Skip (already done)** | OpenClaw uses `sessionKey: "main"` — that IS session reuse at the OpenClaw layer. New WS connection per request is intentional. Fixing this requires OpenClaw protocol changes, out of scope. |
| Per-thread concurrency lock | **✅ Implement** | Core fix. One in-flight request per thread, hard reject second. |
| Per-thread rate limit | **✅ Implement** | Safety net for automated clients. 10 req/min per thread is generous for human use, blocks script abuse. |

---

## Task 1: Create `lib/rate-limiter.ts`

**Files:**
- Create: `lib/rate-limiter.ts`
- Test: `tests/unit/rate-limiter.test.ts`

### Step 1: Write the failing tests

Create `tests/unit/rate-limiter.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ChatRateLimiter, RateLimitResult } from '@/lib/rate-limiter'

describe('ChatRateLimiter', () => {
  let limiter: ChatRateLimiter

  beforeEach(() => {
    vi.useFakeTimers()
    // 3 req/min limit for test speed, 1 concurrent max
    limiter = new ChatRateLimiter({ windowMs: 60_000, maxPerWindow: 3 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('concurrent lock', () => {
    it('allows first request through', () => {
      const result = limiter.check('thread-1')
      expect(result.allowed).toBe(true)
    })

    it('blocks second concurrent request for same thread', () => {
      limiter.check('thread-1') // first — in-flight
      const result = limiter.check('thread-1')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('concurrent')
    })

    it('allows requests on different threads concurrently', () => {
      limiter.check('thread-1')
      const result = limiter.check('thread-2')
      expect(result.allowed).toBe(true)
    })

    it('allows next request after release', () => {
      limiter.check('thread-1')
      limiter.release('thread-1')
      const result = limiter.check('thread-1')
      expect(result.allowed).toBe(true)
    })

    it('release on non-inflight thread is a no-op', () => {
      expect(() => limiter.release('thread-noop')).not.toThrow()
    })
  })

  describe('rate window', () => {
    it('allows up to maxPerWindow requests', () => {
      limiter.check('thread-1'); limiter.release('thread-1')
      limiter.check('thread-1'); limiter.release('thread-1')
      const result = limiter.check('thread-1')
      expect(result.allowed).toBe(true) // 3rd — at limit, still ok
    })

    it('blocks request beyond maxPerWindow', () => {
      limiter.check('thread-1'); limiter.release('thread-1')
      limiter.check('thread-1'); limiter.release('thread-1')
      limiter.check('thread-1'); limiter.release('thread-1')
      const result = limiter.check('thread-1')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('rate_limit')
      expect(result.retryAfterMs).toBeGreaterThan(0)
    })

    it('resets after window expires', () => {
      limiter.check('thread-1'); limiter.release('thread-1')
      limiter.check('thread-1'); limiter.release('thread-1')
      limiter.check('thread-1'); limiter.release('thread-1')
      // Window is 60s — advance past it
      vi.advanceTimersByTime(61_000)
      const result = limiter.check('thread-1')
      expect(result.allowed).toBe(true)
    })
  })
})
```

### Step 2: Run tests to verify they fail

```bash
cd /Users/michaelenriquez/Code/war-room
npx vitest run tests/unit/rate-limiter.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/rate-limiter'`

### Step 3: Write minimal implementation

Create `lib/rate-limiter.ts`:

```typescript
/**
 * In-memory chat rate limiter.
 *
 * Two protections per threadId:
 *   1. Concurrent lock  — rejects if a request is already in-flight for this thread
 *   2. Rate window      — rejects if > maxPerWindow requests in windowMs
 *
 * Single-process only. Appropriate for a local Next.js instance with one user.
 */

export interface RateLimitResult {
  allowed: boolean
  reason?: 'concurrent' | 'rate_limit'
  retryAfterMs?: number
}

interface WindowEntry {
  count: number
  windowStart: number
}

export interface RateLimiterConfig {
  windowMs?: number      // default: 60_000 (1 minute)
  maxPerWindow?: number  // default: 10
}

export class ChatRateLimiter {
  private inFlight = new Set<string>()
  private windows = new Map<string, WindowEntry>()
  private readonly windowMs: number
  private readonly maxPerWindow: number

  constructor(config: RateLimiterConfig = {}) {
    this.windowMs = config.windowMs ?? 60_000
    this.maxPerWindow = config.maxPerWindow ?? 10
  }

  /**
   * Check if a request for threadId is allowed.
   * If allowed, marks the thread as in-flight and increments window count.
   * Caller MUST call release(threadId) when done (even on error).
   */
  check(threadId: string): RateLimitResult {
    // 1. Concurrent lock
    if (this.inFlight.has(threadId)) {
      return { allowed: false, reason: 'concurrent', retryAfterMs: 0 }
    }

    // 2. Rate window
    const now = Date.now()
    const entry = this.windows.get(threadId)

    if (entry && now - entry.windowStart < this.windowMs) {
      // Still in same window
      if (entry.count >= this.maxPerWindow) {
        const retryAfterMs = this.windowMs - (now - entry.windowStart)
        return { allowed: false, reason: 'rate_limit', retryAfterMs }
      }
      entry.count++
    } else {
      // New window
      this.windows.set(threadId, { count: 1, windowStart: now })
    }

    // Approved — mark in-flight
    this.inFlight.add(threadId)
    return { allowed: true }
  }

  /**
   * Release the in-flight lock for threadId.
   * Call this in a finally block after the stream completes or errors.
   */
  release(threadId: string): void {
    this.inFlight.delete(threadId)
  }
}

// Singleton — shared across all requests in the same process
export const chatRateLimiter = new ChatRateLimiter()
```

### Step 4: Run tests to verify they pass

```bash
cd /Users/michaelenriquez/Code/war-room
npx vitest run tests/unit/rate-limiter.test.ts
```

Expected: All tests PASS

### Step 5: Commit

```bash
cd /Users/michaelenriquez/Code/war-room
git add lib/rate-limiter.ts tests/unit/rate-limiter.test.ts
git commit -m "feat: add in-memory chat rate limiter (concurrent lock + rate window)"
```

---

## Task 2: Wire rate limiter into `app/api/chat/route.ts`

**Files:**
- Modify: `app/api/chat/route.ts` (lines 1-20 for import, lines 16-22 for check, line 238 for release)
- Test: `tests/unit/chat-rate-limiter-integration.test.ts`

### Step 1: Write the failing integration tests

Create `tests/unit/chat-rate-limiter-integration.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks (before imports) ----

const mockSaveMessage = vi.fn().mockResolvedValue({ id: 'msg-1' })
const mockGetThread = vi.fn().mockResolvedValue({ title: 'Test', agent_id: 'cc' })
const mockGetThreadSessionId = vi.fn().mockResolvedValue(null)
const mockSetThreadSessionId = vi.fn().mockResolvedValue(undefined)
const mockClearThreadSessionId = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/chat', () => ({
  saveMessage: (...a: unknown[]) => mockSaveMessage(...a),
  getThread: (...a: unknown[]) => mockGetThread(...a),
  getThreadSessionId: (...a: unknown[]) => mockGetThreadSessionId(...a),
  setThreadSessionId: (...a: unknown[]) => mockSetThreadSessionId(...a),
  clearThreadSessionId: (...a: unknown[]) => mockClearThreadSessionId(...a),
}))

vi.mock('@/lib/agent-identity', () => ({
  getAgentSystemPrompt: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/request-context', () => ({
  createRequestContext: vi.fn(() => ({ log: vi.fn() })),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(() => null),
}))

vi.mock('@/lib/openclaw-client', () => ({
  sendToOpenClaw: vi.fn(),
}))

vi.mock('@/lib/pulse-context', () => ({
  buildPulseContext: vi.fn().mockResolvedValue(''),
}))

vi.mock('@/lib/pulse-alerts', () => ({
  generateAlerts: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/pulse-actions', () => ({
  parseActions: vi.fn().mockReturnValue([]),
  executeActions: vi.fn().mockResolvedValue([]),
  stripActionBlocks: vi.fn((s: string) => s),
}))

// Slow stream factory — stays in-flight long enough to test concurrency
function makeSlowStream(delayMs = 50): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
      controller.enqueue('response text')
      controller.close()
    },
  })
}

vi.mock('@/lib/claude-cli', () => ({
  spawnClaude: vi.fn(() => makeSlowStream()),
}))

// ---- Rate limiter: use real module but reset singleton between tests ----
vi.mock('@/lib/rate-limiter', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/rate-limiter')>()
  return real
})

// ---- Import route AFTER all mocks ----
import { POST } from '@/app/api/chat/route'
import { NextRequest } from 'next/server'
import { chatRateLimiter } from '@/lib/rate-limiter'

function makeRequest(threadId: string, content = 'hello') {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({ threadId, content }),
    headers: { 'Content-Type': 'application/json' },
  })
}

async function drainStream(res: Response): Promise<string> {
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    text += dec.decode(value)
  }
  return text
}

describe('chat route — rate limiter integration', () => {
  beforeEach(() => {
    // Reset singleton state between tests
    // Release any lingering in-flight locks by accessing internals
    // @ts-expect-error — test-only access
    chatRateLimiter['inFlight'].clear()
    // @ts-expect-error — test-only access
    chatRateLimiter['windows'].clear()
  })

  it('returns 200 for normal request', async () => {
    const res = await POST(makeRequest('thread-normal'))
    expect(res.status).toBe(200)
    await drainStream(res)
  })

  it('returns 429 for concurrent request on same thread', async () => {
    // Start first request — don't await (it's slow)
    const first = POST(makeRequest('thread-concurrent'))
    // Immediately fire second
    const second = await POST(makeRequest('thread-concurrent'))
    expect(second.status).toBe(429)
    const body = await second.json()
    expect(body.error).toMatch(/in.progress|concurrent/i)
    // Drain first to avoid hanging
    await drainStream(await first)
  })

  it('allows sequential requests on same thread', async () => {
    const first = await POST(makeRequest('thread-seq'))
    await drainStream(first)
    const second = await POST(makeRequest('thread-seq'))
    expect(second.status).toBe(200)
    await drainStream(second)
  })

  it('allows concurrent requests on different threads', async () => {
    const a = POST(makeRequest('thread-a'))
    const b = POST(makeRequest('thread-b'))
    const [ra, rb] = await Promise.all([a, b])
    expect(ra.status).toBe(200)
    expect(rb.status).toBe(200)
    await Promise.all([drainStream(ra), drainStream(rb)])
  })
})
```

### Step 2: Run tests to verify they fail

```bash
cd /Users/michaelenriquez/Code/war-room
npx vitest run tests/unit/chat-rate-limiter-integration.test.ts
```

Expected: FAIL — 429 test fails (route doesn't reject concurrent yet)

### Step 3: Modify `app/api/chat/route.ts`

Add import at the top (after existing imports, line ~11):

```typescript
import { chatRateLimiter } from '@/lib/rate-limiter'
```

Add rate limit check after input validation (after line 22 `if (!threadId || !content)` block):

```typescript
  // Rate limit check — one in-flight request per thread, 10 req/min max
  const rateLimitResult = chatRateLimiter.check(threadId)
  if (!rateLimitResult.allowed) {
    const headers: Record<string, string> = {}
    if (rateLimitResult.retryAfterMs) {
      headers['Retry-After'] = String(Math.ceil(rateLimitResult.retryAfterMs / 1000))
    }
    const reason = rateLimitResult.reason === 'concurrent'
      ? 'Request already in progress for this thread'
      : 'Too many requests — slow down'
    return Response.json({ error: reason }, { status: 429, headers })
  }
```

Add release in the `finally` block of the stream's `start` function (inside the `async start(controller)` try/catch/finally):

```typescript
      } finally {
        chatRateLimiter.release(threadId)
        controller.close()
      }
```

> **Note:** The existing `finally` block at line 235 only calls `controller.close()`. Replace it with the above so release always runs.

### Step 4: Run integration tests to verify they pass

```bash
cd /Users/michaelenriquez/Code/war-room
npx vitest run tests/unit/chat-rate-limiter-integration.test.ts
```

Expected: All 4 tests PASS

### Step 5: Run full test suite — verify no regressions

```bash
cd /Users/michaelenriquez/Code/war-room
npx vitest run tests/unit/
```

Expected: All existing tests PASS (new tests added, nothing broken)

### Step 6: Commit

```bash
cd /Users/michaelenriquez/Code/war-room
git add app/api/chat/route.ts tests/unit/chat-rate-limiter-integration.test.ts
git commit -m "feat: wire chat rate limiter into POST /api/chat — 429 on concurrent + rate excess"
```

---

## Task 3: Manual smoke test

### Step 1: Start dev server

```bash
cd /Users/michaelenriquez/Code/war-room
npm run dev
```

### Step 2: Fire two rapid requests to same thread

```bash
# Get a real threadId from the UI first, then:
THREAD_ID="<your-thread-id>"

curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"threadId\":\"$THREAD_ID\",\"content\":\"test message 1\"}" &

curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"threadId\":\"$THREAD_ID\",\"content\":\"test message 2\"}"
```

Expected: Second request returns `{"error":"Request already in progress for this thread"}` with HTTP 429.

### Step 3: Verify normal chat still works

Open War Room in browser. Send a message normally. Confirm response streams through as before.

### Step 4: Commit smoke test confirmation

No code changes — just confirm behavior.

---

## Rollback

Both changes are additive and isolated to one new file + one import + three lines in route.ts.

```bash
# Full rollback if needed:
git revert HEAD~1  # reverts route.ts wiring
git revert HEAD~2  # reverts rate-limiter.ts creation
```

Or simply remove the `chatRateLimiter.check()` and `chatRateLimiter.release()` calls from route.ts.

---

## What this does NOT fix

- **OpenClaw WS connection overhead** — New WebSocket per Makima request. Fixing this requires persistent WS pooling at the OpenClaw layer, separate project.
- **Multi-server deployments** — In-memory rate limiter is process-local. If war-room ever runs on multiple instances, replace with Redis-backed implementation.
- **Batching** — Not implemented. Wrong abstraction for this SSE chat pattern.
