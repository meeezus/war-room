# Sentry Error Tracking — Wire captureError Everywhere

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the existing `captureError`/`captureWarning` wrappers (already in `lib/sentry.ts`) into every error site so production errors carry structured context (agentId, threadId, missionId, etc.) instead of being untagged noise.

**Architecture:** Sentry SDK (`@sentry/nextjs@10.40.0`) is already installed and configured. Three config files exist (`instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`), `instrumentation.ts` has `onRequestError`, `next.config.ts` has conditional `withSentryConfig`. The `captureError` wrapper in `lib/sentry.ts` is complete but never called. `consoleLoggingIntegration` auto-captures all `console.error` calls today — but with zero structured context. This plan adds context tags (operation, agentId, threadId, missionId) so errors are filterable in Sentry.

**Tech Stack:** `@sentry/nextjs@10.40.0`, `lib/sentry.ts` (captureError, captureWarning — already implemented)

---

## Current State (What Already Works)

- ✅ `@sentry/nextjs` installed
- ✅ `instrumentation-client.ts` — client Sentry init with `consoleLoggingIntegration`
- ✅ `sentry.server.config.ts` — server Sentry init with `consoleLoggingIntegration`
- ✅ `sentry.edge.config.ts` — edge Sentry init (no consoleLoggingIntegration — intentional, not supported in edge)
- ✅ `instrumentation.ts` — `onRequestError` captures unhandled server errors
- ✅ `next.config.ts` — `withSentryConfig` conditional on `SENTRY_AUTH_TOKEN`
- ✅ `lib/sentry.ts` — `captureError(error, operation, ctx)` and `captureWarning(message, ctx)` ready
- ⚠️ `NEXT_PUBLIC_SENTRY_DSN` must be set in Vercel env vars for production capture

## What's Missing

- ❌ `captureError` is called **zero times** anywhere — all errors go through raw `console.error`
- ❌ No `app/error.tsx` — client render crashes show blank screen, no Sentry capture
- ❌ No `app/global-error.tsx` — root layout crashes go uncaught
- ❌ Silent swallows in `status-ribbon.tsx` (`.catch(() => setHealth(null))` — no log, no capture)

---

## Sprint 1: Error Boundaries

### Task 1: Create app/error.tsx

**Files:**
- Create: `app/error.tsx`

**Step 1: Create the file**

```tsx
// app/error.tsx
'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground font-mono">
          {error.digest ?? 'runtime error'}
        </p>
        <button
          onClick={reset}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          retry
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/michaelenriquez/Code/war-room
npx tsc --noEmit
```
Expected: No errors on `app/error.tsx`.

**Step 3: Commit**

```bash
git add app/error.tsx
git commit -m "feat: add route-level error boundary with Sentry capture"
```

---

### Task 2: Create app/global-error.tsx

**Files:**
- Create: `app/global-error.tsx`

Note: `global-error.tsx` replaces the root layout when the root throws. It must provide its own `<html>` and `<body>`.

**Step 1: Create the file**

```tsx
// app/global-error.tsx
'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body
        style={{
          background: '#0a0a0a',
          color: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <p style={{ fontSize: '14px', color: '#888', fontFamily: 'monospace' }}>
          {error.digest ?? 'fatal error'}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '6px 14px',
            border: '1px solid #333',
            borderRadius: '6px',
            background: 'transparent',
            color: '#fafafa',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          retry
        </button>
      </body>
    </html>
  )
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add app/global-error.tsx
git commit -m "feat: add global error boundary for root layout crashes"
```

---

## Sprint 2: lib/queries.ts — Wire captureError

51 `console.error` calls. Pattern is identical across all: replace bare `console.error` with `captureError` from `lib/sentry.ts`. Entity IDs (missionId, agentId, etc.) should be passed as context where available.

### Task 3: Wire captureError into lib/queries.ts

**Files:**
- Modify: `lib/queries.ts`

**Step 1: Add import at top (after existing imports)**

```typescript
import { captureError } from '@/lib/sentry'
```

**Step 2: Replace all console.error calls**

Apply this pattern across the entire file:

| Before | After |
|--------|-------|
| `console.error('getAgents error:', error)` | `captureError(error, 'getAgents')` |
| `console.error('getMissions error:', error)` | `captureError(error, 'getMissions')` |
| `console.error('getMissionTasks error:', error)` | `captureError(error, 'getMissionTasks', { missionId })` |
| `console.error('getMissionWithTasks mission error:', missionRes.error)` | `captureError(missionRes.error, 'getMissionWithTasks.mission', { missionId: id })` |
| `console.error('getMissionWithTasks tasks error:', tasksRes.error)` | `captureError(tasksRes.error, 'getMissionWithTasks.tasks', { missionId: id })` |
| `console.error('getAgentWithHistory agent error:', agentRes.error)` | `captureError(agentRes.error, 'getAgentWithHistory.agent', { agentId: id })` |
| `console.error('getAgentWithHistory missions error:', missionsRes.error)` | `captureError(missionsRes.error, 'getAgentWithHistory.missions', { agentId: id })` |
| `console.error('getAgentWithHistory events error:', eventsRes.error)` | `captureError(eventsRes.error, 'getAgentWithHistory.events', { agentId: id })` |
| `console.error('getEvents error:', error)` | `captureError(error, 'getEvents')` |
| `console.error('getProjects error:', error)` | `captureError(error, 'getProjects')` |

For functions without entity IDs in scope, just use `captureError(error, 'functionName')`.

For functions with entity IDs in scope, pass them: `captureError(error, 'functionName', { missionId, agentId, proposalId, projectId, objectiveId })` — only include the IDs that exist as variables.

Key functions with entity IDs in scope:
- `getMissionWithTasks(id)` → `missionId: id`
- `getMissionTasks(missionId)` → `{ missionId }`
- `getAgentWithHistory(id)` → `agentId: id`
- `getProjectWithBoards(id)` → `projectId: id`
- `getBoardWithTasks(id)` → `projectId: id` (the id is the board/project id)
- `approveProposal(id)` → `proposalId: id`
- `rejectProposal(id)` → `proposalId: id`
- `startMission(id)` → `missionId: id`
- `getMissionByProposal(proposalId)` → `{ proposalId }`
- `getProjectMissions(projectId)` → `{ projectId }`

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No type errors. `captureError` accepts `unknown` for the error argument so Supabase errors pass through cleanly.

**Step 4: Verify build**

```bash
npm run build
```
Expected: Successful build.

**Step 5: Commit**

```bash
git add lib/queries.ts
git commit -m "feat: wire captureError into all lib/queries.ts error handlers"
```

---

## Sprint 3: lib/ Support Files

### Task 4: Wire captureError/captureWarning into lib/pulse-context.ts

**Files:**
- Modify: `lib/pulse-context.ts`

**Step 1: Add import**

```typescript
import { captureError } from '@/lib/sentry'
```

**Step 2: Replace console.error calls**

Pattern around line 102–109:
```typescript
// Before:
console.error('[pulse] buildPulseContext error:', err)

// After:
captureError(err, 'pulse.buildPulseContext')
```

For the 8 parallel query errors (lines ~102–109), each call knows which table failed — add table context:
```typescript
// Before pattern (repeated for each parallel query):
console.error('[pulse] agents error:', agentsError)

// After pattern:
captureError(agentsError, 'pulse.fetchAgents')
```

**Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add lib/pulse-context.ts
git commit -m "feat: wire captureError into pulse-context.ts"
```

---

### Task 5: Wire captureWarning into lib/use-realtime-channel.ts + lib/pulse-actions.ts + lib/spark-bridge.ts

**Files:**
- Modify: `lib/use-realtime-channel.ts`
- Modify: `lib/pulse-actions.ts`
- Modify: `lib/spark-bridge.ts`

**lib/use-realtime-channel.ts** (add import, replace 3 calls):

```typescript
import { captureError, captureWarning } from '@/lib/sentry'

// Line ~83 — max channels warning:
// Before: console.warn('[realtime] Max channels reached. Skipping: <channelName>')
// After: captureWarning(`Max channels reached. Skipping: ${channelName}`)

// Line ~117 — max retries exceeded:
// Before: console.error('[realtime] <channelName>: max retries exceeded')
// After: captureError(new Error(`Max retries exceeded: ${channelName}`), 'realtime.maxRetries')

// Line ~127 — CHANNEL_ERROR retry:
// Before: console.warn('[realtime] <channelName>: CHANNEL_ERROR — retry N/MAX in Xms')
// After: captureWarning(`CHANNEL_ERROR on ${channelName}: retry ${retryCount}/${MAX_RETRIES}`)
```

**lib/pulse-actions.ts** (add import, replace 2 calls):

```typescript
import { captureWarning } from '@/lib/sentry'

// Line ~49:
// Before: console.warn('[pulse-actions] Skipping unknown action type')
// After: captureWarning('pulse-actions: unknown action type skipped')

// Line ~52:
// Before: console.warn('[pulse-actions] Malformed JSON in ACTION block')
// After: captureWarning('pulse-actions: malformed JSON in ACTION block')
```

**lib/spark-bridge.ts** (add import, replace 2 calls):

```typescript
import { captureWarning } from '@/lib/sentry'

// Line ~89:
// Before: console.warn('[spark-bridge] POST failed:', status)
// After: captureWarning(`spark-bridge: POST failed with status ${status}`)

// Line ~93:
// Before: console.warn('[spark-bridge] Connection failed:', err.message)
// After: captureWarning(`spark-bridge: connection failed — ${err.message}`)
```

**Step: Verify + commit**

```bash
npx tsc --noEmit
git add lib/use-realtime-channel.ts lib/pulse-actions.ts lib/spark-bridge.ts
git commit -m "feat: wire captureWarning into realtime/pulse/spark lib files"
```

---

## Sprint 4: API Routes

### Task 6: Wire captureError into app/api/chat/route.ts

This is the most critical route — handles all chat streaming. Multiple catch blocks.

**Files:**
- Modify: `app/api/chat/route.ts`

**Step 1: Add import at top**

```typescript
import { captureError } from '@/lib/sentry'
```

**Step 2: Replace console.error calls**

The route has access to `threadId` and `agentId` at the catch sites. Pass them as context:

```typescript
// Before:
console.error('[chat/route] Pulse context failed, proceeding without:', err)

// After:
captureError(err, 'chat.pulseContext', { threadId, agentId })
```

```typescript
// Before (streaming catch):
console.error('[chat/route] Error:', errMsg)

// After:
captureError(err instanceof Error ? err : new Error(errMsg), 'chat.stream', { threadId, agentId })
```

**Step 3: Verify TypeScript + build**

```bash
npx tsc --noEmit && npm run build
```

**Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: wire captureError into chat API route"
```

---

### Task 7: Wire captureError into remaining API routes

**Files:**
- Modify: `app/api/chat/channel-reply/route.ts`
- Modify: `app/api/chat/threads/route.ts`
- Modify: `app/api/chat/threads/[id]/route.ts`
- Modify: `app/api/chat/council/route.ts`
- Modify: `app/api/missions/route.ts`
- Modify: `app/api/missions/[id]/stream/route.ts`
- Modify: `app/api/missions/from-plan/route.ts`
- Modify: `app/api/missions/archive/route.ts`
- Modify: `app/api/proposals/route.ts`
- Modify: `app/api/proposals/[id]/route.ts`
- Modify: `app/api/events/route.ts`
- Modify: `app/api/objectives/route.ts`
- Modify: `app/api/projects/[id]/route.ts`
- Modify: `app/api/discoveries/route.ts`
- Modify: `app/api/agents/stats/route.ts`

**Pattern (apply to every route):**

1. Add import: `import { captureError } from '@/lib/sentry'`
2. Replace each `console.error('[route-name] error:', error)` with:
   ```typescript
   captureError(error, 'routeName.operation', { /* entity IDs from route params */ })
   ```

**Entity IDs available by route:**

| Route | IDs in scope |
|-------|-------------|
| `api/chat/channel-reply` | `channelId`, `agentId` |
| `api/chat/threads/[id]` | `params.id` (threadId) |
| `api/chat/council` | `threadId`, `agentId` |
| `api/missions/[id]/stream` | `params.id` (missionId) |
| `api/missions/from-plan` | none available at catch site |
| `api/missions/archive` | none available at catch site |
| `api/proposals/[id]` | `params.id` (proposalId) |
| `api/projects/[id]` | `params.id` (projectId) |
| `api/objectives` | none |
| `api/discoveries` | none |
| `api/events` | none |

**Step: After all routes updated, verify TypeScript + build**

```bash
npx tsc --noEmit && npm run build
```
Expected: No errors.

**Step: Commit**

```bash
git add app/api/
git commit -m "feat: wire captureError into all API route error handlers"
```

---

## Sprint 5: Components + Silent Swallows

### Task 8: Wire captureError into components

**Files:**
- Modify: `components/mission-queue.tsx`
- Modify: `components/mission-detail.tsx`
- Modify: `components/mission-kanban-card.tsx`
- Modify: `components/project-card.tsx`
- Modify: `components/chat/chat-actions.tsx`

**Pattern:**

1. Add import: `import { captureError } from '@/lib/sentry'`
2. Replace `console.error` with `captureError(error, 'componentName.action', { missionId, projectId, threadId })` using whatever entity ID is in scope

**Key replacements:**

```typescript
// components/mission-queue.tsx (line ~33) — missionId in scope:
captureError(error, 'MissionQueue.updateStatus', { missionId })

// components/mission-detail.tsx (lines ~82, 85, 100) — missionId in scope:
captureError(error, 'MissionDetail.fetchData', { missionId })
captureError(error, 'MissionDetail.updateStatus', { missionId })
captureError(error, 'MissionDetail.startMission', { missionId })

// components/mission-kanban-card.tsx (line ~66) — missionId in scope:
captureError(error, 'MissionKanbanCard.dragDrop', { missionId })

// components/project-card.tsx (lines ~86, 99) — projectId in scope:
captureError(error, 'ProjectCard.action', { projectId })

// components/chat/chat-actions.tsx (line ~40) — threadId in scope:
captureError(error, 'ChatActions.submit', { threadId })
```

**Step: Verify + commit**

```bash
npx tsc --noEmit
git add components/
git commit -m "feat: wire captureError into component error handlers"
```

---

### Task 9: Fix Silent Swallows in status-ribbon.tsx

The health check silently swallows fetch failures. Add a warning so they show up in Sentry.

**Files:**
- Modify: `components/status-ribbon.tsx`

**Step 1: Add import**

```typescript
import { captureWarning } from '@/lib/sentry'
```

**Step 2: Fix the silent catch (line ~148)**

Before:
```typescript
.catch(() => setHealth(null))
```

After:
```typescript
.catch((err) => {
  captureWarning('status-ribbon: health check failed')
  setHealth(null)
})
```

**Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add components/status-ribbon.tsx
git commit -m "fix: capture silent health check failures in status-ribbon"
```

---

## Verification

**After all tasks complete:**

```bash
npm run build
```
Expected: Clean build.

**Smoke test in production (requires NEXT_PUBLIC_SENTRY_DSN set in Vercel):**

1. Deploy to Vercel preview
2. Trigger a known error path (e.g., disconnect from DB, make a bad API call)
3. Open Sentry dashboard → Issues
4. Confirm error has tags: `operation`, and entity IDs like `missionId`, `threadId`, `agentId`
5. Confirm you can filter by `operation:getAgents` in Sentry search

---

## Env Vars Checklist (Vercel Dashboard)

Before merging to main, ensure these are set in Vercel:

- [ ] `NEXT_PUBLIC_SENTRY_DSN` — from Sentry project → Settings → Client Keys → DSN
- [ ] `SENTRY_AUTH_TOKEN` — from Sentry → Account → API Tokens (scope: `project:releases`)
- [ ] `SENTRY_ORG` — `shogunate` (or override in next.config.ts)
- [ ] `SENTRY_PROJECT` — `war-room` (or override in next.config.ts)

Note: `SENTRY_AUTH_TOKEN` is only needed for source map upload during build. `NEXT_PUBLIC_SENTRY_DSN` is required for runtime error capture.

---

## What This Deliberately Does NOT Change

- **`instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`** — already correct, no changes needed
- **`next.config.ts`** — already correctly conditionally wraps with `withSentryConfig`
- **`instrumentation.ts`** — already has `onRequestError`, no changes needed
- **`lib/sentry.ts`** — wrapper is complete, just gets called now
- **Console.error calls are kept** — `captureError` calls `console.error` internally. No log visibility lost.

---

## Rollback

All changes are additive (import + replace console.error with captureError). To rollback any task:

```bash
git revert <commit-hash>
```

The app continues to work without Sentry — `captureError` gracefully falls back if DSN is unset.
