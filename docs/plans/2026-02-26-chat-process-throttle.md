# Chat Process Throttle — Research & Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent unbounded `claude -p` / OpenClaw spawning from high-frequency chat requests.

**Architecture:** In-memory concurrent lock + sliding rate window already exists inline in route.ts. Plan is to extract this to a proper testable class (`lib/rate-limiter.ts`) per the 2026-02-25 plan. No new protection layers needed — they already exist.

**Tech Stack:** TypeScript, Next.js App Router, Vitest. Zero new dependencies.

---

## FINDINGS: Most Suggestions Already Implemented

**Requested vs. Reality:**

| Suggestion | Status | Notes |
|---|---|---|
| No rate limiting | ✅ Already done | `checkRateLimit(threadId)` — 2 req/sec per thread (line 26-38 of route.ts) |
| No concurrency control | ✅ Already done | `inFlightRequests Map` — one in-flight per thread, 429 on second (line 51-56) |
| Request batching (50-100ms) | ⛔ Skip | SSE streaming = each message IS its own HTTP connection. Batching adds latency for zero benefit. Wrong abstraction. |
| Exponential backoff | ✅ Handled | Route returns `Retry-After` header. Backoff belongs on client, not server. |
| Makima session reuse | ✅ Already done | OpenClaw uses `sessionKey: "main"` — persistent session across requests at the gateway layer. |
| Per-user rate limit | 🟡 Future | Current: per-thread. Single user owns all threads so this is equivalent today. Upgrade to per-userId if multi-user scenario arises. |

**The inline implementation (route.ts lines 18-38):**
- `inFlightRequests: Map<string, boolean>` — mutex per threadId
- `rateLimitBuckets: Map<string, {count, windowStart}>` — 2 req/sec sliding window
- Comments already note the single-process limitation and Redis upgrade path

---

## EXISTING PLAN: Already Covers Remaining Work

`docs/plans/2026-02-25-chat-rate-limiter.md` — **not yet implemented**

That plan extracts the inline logic into `lib/rate-limiter.ts` as a proper class with:
- `ChatRateLimiter` — concurrent lock + rate window, injectable for tests
- `chatRateLimiter` singleton exported for route.ts to use
- Full Vitest tests including route integration tests
- 10 req/min window (vs current 2 req/sec — more generous, still blocks abuse)

**Verdict:** Implement that plan. No new plan needed.

---

## ONLY NEW GAP: Makima Fallback Always Creates Fresh Session

**Finding:** When OpenClaw fails, both fallback paths (sync catch at line 172, stream timeout at line 200) create a new `randomUUID()` session and do NOT persist it:

```typescript
// Line 172 — sync catch on sendToOpenClaw failure
const fallbackSession: ClaudeSession = { sessionId: randomUUID(), threadId }
sourceStream = spawnClaude(messageWithPulse, fallbackSession, { resume: false, ... })

// Line 200 — stream read timeout with no content
const fallbackSession: ClaudeSession = { sessionId: randomUUID(), threadId }
const fallbackStream = spawnClaude(fallbackMessage, fallbackSession, { resume: false, ... })
```

**Impact:** Each OpenClaw failure creates a new Claude process with zero context. If OpenClaw is flapping, consecutive messages to Makima spawn separate context-less sessions.

**Decision: SKIP for now.**

Rationale: When OpenClaw is down, Makima's session state is gone regardless — OpenClaw owns the conversation history. A fresh spawnClaude session is the correct degraded behavior. Persisting a fallback session ID would create the illusion of continuity while the actual Makima context (from OpenClaw's memory) is unavailable. Accept the loss, don't paper over it.

This should be revisited if OpenClaw implements session handoff/export that Claude CLI can resume.

---

## Action: Implement 2026-02-25 Plan

The existing plan at `docs/plans/2026-02-25-chat-rate-limiter.md` is the correct implementation path. Status:

- [ ] Task 1: Create `lib/rate-limiter.ts` with `ChatRateLimiter` class
- [ ] Task 2: Wire into `app/api/chat/route.ts` (replace inline Maps)
- [ ] Task 3: Manual smoke test

**Priority:** Low. The inline implementation works. This is a refactor for testability + the window change (1s → 60s, 2 → 10 max). Do it during cleanup sprint.

---

## Out of Scope

- **Request batching** — Incompatible with SSE streaming architecture. Wrong abstraction.
- **Redis-backed rate limiting** — Only needed for multi-instance Vercel deployment. War Room is single-instance today.
- **Per-user rate limiting** — Single-user app, per-thread equivalent. Revisit if multi-tenant.
- **OpenClaw session handoff** — Requires OpenClaw protocol changes, separate project.
