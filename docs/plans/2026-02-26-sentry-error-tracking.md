# Sentry Error Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Sentry into war-room to capture all production errors with structured context, replacing silent console.error calls that disappear into logs.

**Architecture:** Install `@sentry/nextjs`, initialize via `instrumentation.ts` + `instrumentation-client.ts` (Next.js 15/16 modern pattern). The `consoleLoggingIntegration` automatically captures all 144 existing `console.error` calls on day one. A query error helper adds structured context to lib/queries.ts. API routes get explicit Sentry scope with entity IDs.

**Tech Stack:** `@sentry/nextjs ^10.39.0`, Next.js instrumentation API, `withSentryConfig` wrapping existing `withSerwist`

---

## Scope

- **144 console.error calls across 40 files** — captured automatically by `consoleLoggingIntegration`
- **51 in lib/queries.ts** — enhanced with structured context via helper (Sprint 2)
- **Top API routes** — explicit Sentry scope with entity IDs (Sprint 2)
- **No global error boundary exists** — add app/error.tsx (Sprint 3)

---

## Sprint 1: Foundation

Auto-capture all existing errors with zero per-file changes.

### Task 1: Install @sentry/nextjs

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

```bash
cd /Users/michaelenriquez/Code/war-room
npm install @sentry/nextjs@^10.39.0
```

**Step 2: Verify installation**

```bash
node -e "require('@sentry/nextjs'); console.log('OK')"
```
Expected: `OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @sentry/nextjs"
```

---

### Task 2: Create Sentry Config Files

**Files:**
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Create: `instrumentation-client.ts`

**Step 1: Create `sentry.server.config.ts`**

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enableLogs: true,
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
  ],
})
```

**Step 2: Create `sentry.edge.config.ts`**

```typescript
// sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs'

// Note: consoleLoggingIntegration not supported in edge runtime
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

**Step 3: Create `instrumentation-client.ts`**

```typescript
// instrumentation-client.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enableLogs: true,
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
  ],
})
```

---

### Task 3: Create instrumentation.ts

**Files:**
- Create: `instrumentation.ts`

**Step 1: Create the file**

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = async (
  err: unknown,
  request: { method: string; url: string },
  context: { routePath: string }
) => {
  const { captureRequestError } = await import('@sentry/nextjs')
  captureRequestError(err, request, context)
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors on the new files.

---

### Task 4: Update next.config.ts with withSentryConfig

**Files:**
- Modify: `next.config.ts`

**Step 1: Read current content**

Current:
```typescript
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withSerwist(nextConfig);
```

**Step 2: Update to compose withSentryConfig**

```typescript
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},
};

const sentryConfig = {
  org: "shogunate",
  project: "war-room",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
};

// Guard: skip Sentry build plugin if no auth token (local dev, no-secret environments)
const wrappedConfig = withSerwist(nextConfig);

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(wrappedConfig, sentryConfig)
  : wrappedConfig;
```

**Step 3: Verify build compiles**

```bash
npm run build
```
Expected: Successful build (Sentry plugin disabled locally since no SENTRY_AUTH_TOKEN).

---

### Task 5: Update Environment Variables

**Files:**
- Modify: `.env.local.example` (if exists) or create `.env.local.example`

**Step 1: Add Sentry vars**

Append to `.env.local.example`:
```
# Sentry Error Tracking
NEXT_PUBLIC_SENTRY_DSN=          # From sentry.io project settings → Client Keys (DSN)
SENTRY_AUTH_TOKEN=               # From sentry.io Account → API Tokens (scope: project:write)
```

**Step 2: Add actual values to .env.local**

```bash
# Create a Sentry project at https://sentry.io if one doesn't exist for war-room
# Copy DSN from: Project Settings → Client Keys → DSN
# Copy auth token from: Account → API Tokens → Create Token (project:releases scope)
echo "NEXT_PUBLIC_SENTRY_DSN=<your-dsn-here>" >> .env.local
echo "SENTRY_AUTH_TOKEN=<your-token-here>" >> .env.local
```

**Step 3: Commit config files (no secrets)**

```bash
git add sentry.server.config.ts sentry.edge.config.ts instrumentation-client.ts instrumentation.ts next.config.ts .env.local.example
git commit -m "feat: add Sentry foundation - auto-capture all console.error calls"
```

**Acceptance:**
- Given: war-room is running
- When: `console.error('test', new Error('test'))` fires in any route
- Then: Error appears in Sentry dashboard within 30 seconds

---

## Sprint 2: Structured Context

Add entity IDs and operation names to the highest-value error sites.

### Task 6: Create Query Error Helper

lib/queries.ts has 51 inline `console.error` calls with no context beyond the error object. A helper adds structured Sentry tags while keeping the console.error for local visibility.

**Files:**
- Create: `lib/sentry-helpers.ts`

**Step 1: Create the helper**

```typescript
// lib/sentry-helpers.ts
import * as Sentry from '@sentry/nextjs'

type QueryContext = {
  operation: string
  table: string
  entityId?: string
  extra?: Record<string, unknown>
}

/**
 * Captures a Supabase query error with structured context.
 * Keeps the console.error for local dev visibility.
 */
export function captureQueryError(
  error: unknown,
  context: QueryContext
): void {
  const { operation, table, entityId, extra } = context

  console.error(`${operation} error:`, error)

  Sentry.withScope((scope) => {
    scope.setTag('layer', 'data')
    scope.setTag('operation', operation)
    scope.setTag('table', table)
    if (entityId) scope.setTag('entityId', entityId)
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => scope.setExtra(k, v))
    }
    Sentry.captureException(error)
  })
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: No errors.

---

### Task 7: Update lib/queries.ts — Top 10 Functions

Update the 10 most critical query functions to use `captureQueryError`. These cover mission/agent/event data — the core operational data.

**Files:**
- Modify: `lib/queries.ts`

**Step 1: Add import at top of lib/queries.ts**

Add after the existing imports:
```typescript
import { captureQueryError } from '@/lib/sentry-helpers'
```

**Step 2: Update getAgents**

Before:
```typescript
if (error) { console.error('getAgents error:', error); return [] }
```
After:
```typescript
if (error) { captureQueryError(error, { operation: 'getAgents', table: 'agent_status' }); return [] }
```

**Step 3: Update getMissions**

Before:
```typescript
if (error) { console.error('getMissions error:', error); return [] }
```
After:
```typescript
if (error) { captureQueryError(error, { operation: 'getMissions', table: 'missions' }); return [] }
```

**Step 4: Update getMissionWithTasks**

Before:
```typescript
if (missionRes.error) { console.error('getMissionWithTasks mission error:', missionRes.error) }
if (tasksRes.error) { console.error('getMissionWithTasks tasks error:', tasksRes.error) }
```
After:
```typescript
if (missionRes.error) { captureQueryError(missionRes.error, { operation: 'getMissionWithTasks.mission', table: 'missions', entityId: id }) }
if (tasksRes.error) { captureQueryError(tasksRes.error, { operation: 'getMissionWithTasks.tasks', table: 'tasks', entityId: id }) }
```

**Step 5: Update getEvents, getMissionTasks, getAgentWithHistory**

Apply same pattern — replace `console.error('fnName error:', error)` with:
```typescript
captureQueryError(error, { operation: 'functionName', table: 'table_name', entityId: relevantId })
```

Continue for: `getEvents`, `getMissionTasks`, `getAgentWithHistory` (3 calls), `getStats`.

**Step 6: Verify TypeScript + build**

```bash
npx tsc --noEmit && npm run build
```
Expected: No errors.

**Step 7: Commit**

```bash
git add lib/sentry-helpers.ts lib/queries.ts
git commit -m "feat: add structured Sentry context to Supabase query errors"
```

---

### Task 8: Instrument Top API Routes

Add Sentry scope to the 4 highest-traffic API routes. These have try/catch blocks where console.error fires — upgrade them to include request context.

**Files:**
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/chat/council/route.ts`
- Modify: `app/api/events/route.ts`
- Modify: `app/api/missions/from-plan/route.ts`

**Pattern to apply to each route's catch block:**

Before (example from app/api/chat/route.ts):
```typescript
} catch (error) {
  console.error('[chat] Error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

After:
```typescript
} catch (error) {
  console.error('[chat] Error:', error)
  Sentry.withScope((scope) => {
    scope.setTag('route', '/api/chat')
    scope.setTag('layer', 'api')
    // Add entity IDs from the request body if available (missionId, agentId, etc.)
    Sentry.captureException(error)
  })
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

Apply the same pattern to council, events, and from-plan routes.

**Add import to each file:**
```typescript
import * as Sentry from '@sentry/nextjs'
```

**Step after each route:** Run `npx tsc --noEmit` to verify no type errors.

**Step: Commit**

```bash
git add app/api/chat/route.ts app/api/chat/council/route.ts app/api/events/route.ts app/api/missions/from-plan/route.ts
git commit -m "feat: add Sentry context to top API route error handlers"
```

**Acceptance:**
- Given: an API route throws
- When: Sentry receives the error
- Then: error includes `route` and `layer` tags, visible in Sentry filter sidebar

---

## Sprint 3: Error Boundary

### Task 9: Add Global Error Boundary

No `app/error.tsx` exists. Next.js App Router requires this to show a recovery UI instead of a crash screen. Sentry's `ErrorBoundary` logs the client-side render error.

**Files:**
- Create: `app/error.tsx`

**Step 1: Create app/error.tsx**

```typescript
// app/error.tsx
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

**Step 2: Verify build**

```bash
npm run build
```
Expected: Successful. No type errors.

**Step 3: Commit**

```bash
git add app/error.tsx
git commit -m "feat: add global error boundary with Sentry reporting"
```

**Acceptance:**
- Given: a React component throws during render
- When: error boundary catches it
- Then: Sentry receives the exception + a recovery UI is shown (not a blank page)

---

## Setup Checklist (Pre-Deploy)

Before merging, confirm:

- [ ] Sentry project created at sentry.io (org: `shogunate`, project: `war-room`)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` in Vercel/Render env vars
- [ ] `SENTRY_AUTH_TOKEN` in Vercel/Render env vars (for source map upload)
- [ ] Local test: trigger an error, confirm it appears in Sentry dashboard
- [ ] `npm run build` passes clean

---

## What This Does NOT Cover

- **Remaining 90+ console.error calls** in non-query files — these ARE captured by `consoleLoggingIntegration` automatically. Manual context wrapping deferred until Sentry data reveals which ones actually fire in production.
- **Performance monitoring** — `tracesSampleRate: 0.1` captures 10% of transactions. Tune once baseline is established.
- **User identification** — war-room has no auth. If auth is added later, call `Sentry.setUser({ id, email })` in middleware.

---

## Verification

After deploying:

1. Open war-room in browser
2. Check Sentry dashboard — you should see the app connecting (SDK init event)
3. Manually trigger an error: navigate to a page that loads data, check if any Supabase errors appear
4. Confirm error tags: `operation`, `table`, `layer` are searchable in Sentry

---

## Rollback

```bash
# Remove Sentry entirely
npm uninstall @sentry/nextjs
git rm sentry.server.config.ts sentry.edge.config.ts instrumentation-client.ts instrumentation.ts
# Revert next.config.ts and lib/queries.ts
git revert HEAD~<N>
```

The rollback path is clean — Sentry is additive only. No existing console.error calls are removed, just supplemented.
