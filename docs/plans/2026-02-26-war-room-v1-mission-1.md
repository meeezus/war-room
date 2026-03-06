# War Room v1 — Mission 1: Error Boundaries + Silent Swallow Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add missing error boundaries and fix 3 silent error swallows so production crashes show recoverable UI instead of blank screens, and production errors become visible in Sentry.

**Architecture:** All tasks are additive — 2 new files + 2 targeted patches. Zero shared state between tasks. Parallel group 1 contains all 4.

**Tech Stack:** Next.js 15 App Router, `@sentry/nextjs@10.40.0` (already installed), TypeScript

**Why this is Mission 1:** The build is clean, core features ship, Sentry is wired in API routes — but client crashes produce blank screens (no `error.tsx`/`global-error.tsx`) and 2 dashboard fetch errors are fully swallowed (no log, no Sentry, no state change).

**Verification:** `npm run build` passes. No TypeScript errors. Client crash → recoverable error UI.

---

## Branch

```bash
git checkout main && git pull origin main
git checkout -b feature/error-boundaries
```

---

## Parallel Group 1 (all independent — spawn simultaneously)

### Task 1: app/error.tsx — Route-Level Error Boundary

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When a route component crashes during render, I want an error UI instead of a blank screen so the user can retry without a full refresh.

**Outcome:** Any unhandled render exception within a route segment shows a minimal error card and triggers Sentry capture.

**Files:**
- Create: `app/error.tsx`

**Step 1: Write the failing check**

Run: `ls /Users/michaelenriquez/Code/war-room/app/error.tsx`
Expected: `No such file or directory`

**Step 2: Create the file**

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

**Step 3: Type check**

Run: `cd /Users/michaelenriquez/Code/war-room && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors on `app/error.tsx`

**Step 4: Commit**

```bash
git add app/error.tsx
git commit -m "feat: add route-level error boundary with Sentry capture"
```

**Acceptance:**
- **Given** a route component throws during render
- **When** Next.js catches the error
- **Then** the error boundary renders with retry button; Sentry receives the exception

---

### Task 2: app/global-error.tsx — Root Layout Error Boundary

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When the root layout itself crashes, I want a recovery page instead of a completely blank browser tab.

**Outcome:** Root-level uncaught errors show a minimal recovery UI. `global-error.tsx` must supply its own `<html>` and `<body>` since the root layout is unavailable when it fires.

**Files:**
- Create: `app/global-error.tsx`

**Step 1: Write the failing check**

Run: `ls /Users/michaelenriquez/Code/war-room/app/global-error.tsx`
Expected: `No such file or directory`

**Step 2: Create the file**

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
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ textAlign: 'center', gap: '16px', display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
            {error.digest ?? 'critical error'}
          </p>
          <button
            onClick={reset}
            style={{
              fontSize: '12px',
              color: '#888',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            retry
          </button>
        </div>
      </body>
    </html>
  )
}
```

Note: Inline styles are intentional — Tailwind CSS is unavailable when the root layout crashes.

**Step 3: Type check**

Run: `cd /Users/michaelenriquez/Code/war-room && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors on `app/global-error.tsx`

**Step 4: Commit**

```bash
git add app/global-error.tsx
git commit -m "feat: add global error boundary for root layout crashes"
```

**Acceptance:**
- **Given** the root layout throws during render
- **When** Next.js triggers global-error recovery
- **Then** the recovery page renders with retry button; Sentry receives the exception; the page uses inline styles (not Tailwind)

---

### Task 3: Fix status-ribbon.tsx silent health fetch swallow

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When the health API fails silently in the status ribbon, I want the error captured so production degradation is visible in Sentry.

**Outcome:** The `.catch(() => setHealth(null))` in `status-ribbon.tsx:149` logs to console and captures to Sentry via `captureWarning`.

**Files:**
- Modify: `components/status-ribbon.tsx` (~line 145-152)

**Step 1: Find the exact location**

Run: `grep -n "setHealth(null)" /Users/michaelenriquez/Code/war-room/components/status-ribbon.tsx`
Expected: Line with `.catch(() => setHealth(null))`

**Step 2: Read the surrounding block**

Read `components/status-ribbon.tsx` around the found line to see the full fetch call.

**Step 3: Add captureWarning import (if not present)**

Check top of file:
```bash
grep "captureWarning\|captureError" /Users/michaelenriquez/Code/war-room/components/status-ribbon.tsx
```

If not imported, add to imports:
```tsx
import { captureWarning } from '@/lib/sentry'
```

**Step 4: Replace the silent catch**

Before:
```tsx
.catch(() => setHealth(null));
```

After:
```tsx
.catch((err) => {
  captureWarning('health-check fetch failed', { operation: 'status-ribbon.fetchHealth' })
  console.error('[status-ribbon] health fetch failed:', err)
  setHealth(null)
});
```

**Step 5: Type check**

Run: `cd /Users/michaelenriquez/Code/war-room && npx tsc --noEmit 2>&1 | grep "status-ribbon" | head -10`
Expected: No errors

**Step 6: Commit**

```bash
git add components/status-ribbon.tsx
git commit -m "fix: capture health fetch error in status-ribbon instead of silent swallow"
```

**Acceptance:**
- **Given** the `/api/health` endpoint fails
- **When** status-ribbon's fetch catches the error
- **Then** `captureWarning` fires with operation context; `console.error` logs locally; `setHealth(null)` still runs (UI shows degraded state)

---

### Task 4: Fix dashboard/page.tsx silent fetch swallows

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When usage/recap fetch fails silently on the dashboard, I want production degradation visible instead of invisible.

**Outcome:** Two `.catch(() => {})` calls in `app/dashboard/page.tsx:82,92` capture to Sentry with context.

**Files:**
- Modify: `app/dashboard/page.tsx` (~lines 80-95)

**Step 1: Find the exact locations**

Run: `grep -n "catch(() => {})" /Users/michaelenriquez/Code/war-room/app/dashboard/page.tsx`
Expected: 2 matches around lines 82 and 92

**Step 2: Check if captureError/captureWarning already imported**

```bash
grep "captureError\|captureWarning\|sentry" /Users/michaelenriquez/Code/war-room/app/dashboard/page.tsx | head -5
```

If not imported, add:
```tsx
import { captureWarning } from '@/lib/sentry'
```

**Step 3: Read surrounding context**

Read `app/dashboard/page.tsx` lines 75-100 to understand which fetch each swallow belongs to (recapCount, usageData).

**Step 4: Replace both silent catches**

Pattern: `.catch(() => {})` → `.catch((err) => captureWarning('<operation>', { operation: '<context>' }))`

For the recapCount fetch (around line 82):
```tsx
.catch((err) => captureWarning('recap count fetch failed', { operation: 'dashboard.fetchRecapCount' }))
```

For the usageData fetch (around line 92):
```tsx
.catch((err) => captureWarning('usage data fetch failed', { operation: 'dashboard.fetchUsageData' }))
```

**Step 5: Type check**

Run: `cd /Users/michaelenriquez/Code/war-room && npx tsc --noEmit 2>&1 | grep "dashboard" | head -10`
Expected: No errors

**Step 6: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "fix: capture dashboard silent fetch failures instead of swallowing"
```

**Acceptance:**
- **Given** the recap count or usage API fails
- **When** dashboard catches the error
- **Then** Sentry receives a warning with operation context; dashboard continues rendering (non-critical fetch)

---

## Final Verification

```bash
cd /Users/michaelenriquez/Code/war-room
npm run build
```

Expected output: Build completes with no errors. All routes listed.

Also verify:
```bash
grep -r "catch(() => {})" app/dashboard/page.tsx  # should return nothing
ls app/error.tsx app/global-error.tsx              # both should exist
```

---

## Ship It

```bash
git push -u origin feature/error-boundaries
gh pr create --title "feat: error boundaries + silent swallow fixes (v1 mission 1)" --body "$(cat <<'EOF'
## Summary
- Adds `app/error.tsx` — route-level error boundary (blank screen → retry UI)
- Adds `app/global-error.tsx` — root layout error boundary (fully blank tab → recovery)
- Fixes `status-ribbon.tsx` silent health fetch swallow → captureWarning + console.error
- Fixes `app/dashboard/page.tsx` silent recap/usage swallows → captureWarning

## Why
Production crashes were producing blank screens with no Sentry capture. All 4 tasks are independent with no conflicts.

## Test Plan
- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` clean
- [ ] `app/error.tsx` renders when route throws
- [ ] `app/global-error.tsx` exists with inline styles (no Tailwind dependency)
- [ ] `grep -r "catch(() => {})" app/` returns nothing for patched files

🤖 Dispatched via Shogunate Engine — Ed (engineering)
EOF
)"
```

---

## Out of Scope

- Migrating `lib/realtime.ts` static channels to `useRealtimeChannel` hook — defer
- Adding `error.tsx` to individual route segments (route-level boundary is sufficient for v1)
- Vitest tests for error boundaries (Next.js error boundaries are smoke-tested via build, not unit tests)
- Chat light-mode zinc migration — already done in recent commits
