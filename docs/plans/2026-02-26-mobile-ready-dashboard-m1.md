# Mobile-Ready Dashboard — Mission 1: Core Layout Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the three biggest mobile usability failures on the Dashboard: StatusRibbon horizontal overflow, TerminalPanel eating 200px by default, and mobile header being info-blind.

**Architecture:** Pure CSS/Tailwind responsiveness changes — no new dependencies, no API changes, no state changes. Each task is a single-component patch. All three can run in parallel.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, TypeScript, Framer Motion (already installed)

---

## The Mobile Problems (verified by reading code, not assumptions)

| Problem | Root Cause | User Impact |
|---------|-----------|-------------|
| StatusRibbon overflow | 7 cards × `min-w-[200px]` = ~1400px in `flex overflow-x-auto` | iPhone 390px: user must swipe just to see SitRep card |
| TerminalPanel always open | `useState(false)` for `collapsed`, `height: 200px` hardcoded | On 844px iPhone, terminal eats 24% of viewport before content |
| Header mobile blindness | All stats wrapped in `hidden md:inline` | Mobile user sees only: title + hamburger + theme toggle |

---

## Parallel Group 1 (all independent — spawn simultaneously)

### Task 1: StatusRibbon — Mobile Grid Layout

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When I open the dashboard on my phone, I want to see all status cards without horizontal scrolling so I can understand system state at a glance.

**Outcome:** On mobile, StatusRibbon renders as a 2×4 compact grid. Cards are smaller (no min-w-[200px]), prioritized by importance (Chat → SitRep → Skills → Health → Council → Recaps → Usage). On desktop (md+), existing horizontal scroll behavior is preserved.

**Files:**
- Modify: `components/status-ribbon.tsx` — card sizing + container layout

**Step 1: Verify the current layout**

Run:
```bash
grep -n "min-w-\|overflow-x-auto\|flex gap" /Users/michaelenriquez/Code/war-room/components/status-ribbon.tsx
```
Expected: Lines with `min-w-[200px]` on each card and `overflow-x-auto` on the container.

**Step 2: Patch the container**

In `components/status-ribbon.tsx`, find the `StatusRibbon` export function's return. Change:

```tsx
// BEFORE
<div className="flex gap-2 md:gap-3 overflow-x-auto pb-2">
```

To:

```tsx
// AFTER
<div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 md:gap-3 sm:overflow-x-auto sm:pb-2">
```

This makes mobile: 2-column grid. Tablet+ (sm=640px): reverts to flex row with scroll.

**Step 3: Patch all card StealthCard wrappers**

Every card has `className="px-4 py-3 min-w-[200px] min-h-[110px] flex-shrink-0 flex flex-col justify-between"`.

Change **all 7 instances** to:

```tsx
// BEFORE
className="px-4 py-3 min-w-[200px] min-h-[110px] flex-shrink-0 flex flex-col justify-between"

// AFTER
className="px-3 py-2.5 sm:px-4 sm:py-3 sm:min-w-[200px] sm:min-h-[110px] sm:flex-shrink-0 flex flex-col justify-between min-h-[90px]"
```

What changed:
- `min-w-[200px]` → only at `sm:` breakpoint (no forced width on mobile)
- `min-h-[110px]` → `min-h-[90px]` on mobile, `sm:min-h-[110px]` on tablet+
- `px-4 py-3` → `px-3 py-2.5` on mobile, restored at `sm:`
- `flex-shrink-0` → only at `sm:`

**Step 4: Verify no TypeScript errors**

Run:
```bash
cd /Users/michaelenriquez/Code/war-room && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors (this is CSS-only, no type changes).

**Step 5: Build check**

Run:
```bash
cd /Users/michaelenriquez/Code/war-room && npm run build 2>&1 | tail -15
```
Expected: Build completes, no errors.

**Step 6: Commit**

```bash
cd /Users/michaelenriquez/Code/war-room
git add components/status-ribbon.tsx
git commit -m "fix(mobile): status ribbon 2-col grid on mobile, scroll preserved on sm+"
```

---

### Task 2: TerminalPanel — Collapsed by Default on Mobile

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When I open the dashboard on my phone, I want the terminal panel to start collapsed so it doesn't eat a quarter of my screen before I see objectives.

**Outcome:** TerminalPanel initializes as `collapsed: true` on screens narrower than 768px (`md` breakpoint). On desktop it stays `collapsed: false`. The existing collapse/expand toggle works identically — this only changes the initial state.

**Files:**
- Modify: `components/terminal/terminal-panel.tsx:51` — initial state logic

**Step 1: Find the collapsed state**

Run:
```bash
grep -n "collapsed\|useState" /Users/michaelenriquez/Code/war-room/components/terminal/terminal-panel.tsx | head -10
```
Expected: Line 51 shows `const [collapsed, setCollapsed] = useState(false)`

**Step 2: Patch the initial state**

In `components/terminal/terminal-panel.tsx`, change line 51:

```tsx
// BEFORE
const [collapsed, setCollapsed] = useState(false)

// AFTER
const [collapsed, setCollapsed] = useState(
  typeof window !== 'undefined' ? window.innerWidth < 768 : false
)
```

This mirrors the exact pattern already used in `app/dashboard/page.tsx:60` for the desktop sidebar (`typeof window !== 'undefined' ? window.innerWidth >= 768 : true`). We're following the established pattern in this codebase.

**Step 3: Verify no TypeScript errors**

Run:
```bash
cd /Users/michaelenriquez/Code/war-room && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors.

**Step 4: Build check**

Run:
```bash
cd /Users/michaelenriquez/Code/war-room && npm run build 2>&1 | tail -15
```
Expected: Build completes, no errors.

**Step 5: Commit**

```bash
cd /Users/michaelenriquez/Code/war-room
git add components/terminal/terminal-panel.tsx
git commit -m "fix(mobile): terminal panel collapses by default on small screens"
```

---

### Task 3: Mobile Header — Show Critical Stats

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When I open the dashboard on my phone, I want to see the most critical operational number (things needing attention) without having to navigate away so I can immediately identify if something needs action.

**Outcome:** Mobile header shows a compact badge: `N need attention` (failed missions + pending discoveries) next to the title. This replaces the completely blank stats area mobile currently has. Desktop behavior (`hidden md:inline`) is unchanged.

**Files:**
- Modify: `app/dashboard/page.tsx` — header section (lines ~145-160)

**Step 1: Find the mobile header area**

Run:
```bash
grep -n "hidden md:inline\|ml-auto\|need attention" /Users/michaelenriquez/Code/war-room/app/dashboard/page.tsx
```
Expected: Lines with `hidden md:inline` on the stats span.

**Step 2: Add mobile attention badge**

In `app/dashboard/page.tsx`, find this block in the header:

```tsx
<span className="ml-auto hidden md:inline font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-muted-foreground/75">
  <Link href="/objectives" className="transition-colors hover:text-foreground/60">
    {objectives.length} objectives
  </Link>
  {" · "}
  <Link href="/missions" className="transition-colors hover:text-foreground/60">
    {missions.filter(m => m.status === 'running').length} running
  </Link>
  {" · "}
  {missions.filter(m => m.status === 'failed').length + pendingDiscoveries} need attention
</span>
```

Replace with:

```tsx
{/* Desktop: full stats bar */}
<span className="ml-auto hidden md:inline font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-muted-foreground/75">
  <Link href="/objectives" className="transition-colors hover:text-foreground/60">
    {objectives.length} objectives
  </Link>
  {" · "}
  <Link href="/missions" className="transition-colors hover:text-foreground/60">
    {missions.filter(m => m.status === 'running').length} running
  </Link>
  {" · "}
  {missions.filter(m => m.status === 'failed').length + pendingDiscoveries} need attention
</span>

{/* Mobile: attention badge only */}
{(() => {
  const attentionCount = missions.filter(m => m.status === 'failed').length + pendingDiscoveries;
  return attentionCount > 0 ? (
    <span className="ml-auto md:hidden rounded-full bg-red-500/15 px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs font-medium text-red-400">
      {attentionCount} need attention
    </span>
  ) : (
    <span className="ml-auto md:hidden font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground/50">
      {missions.filter(m => m.status === 'running').length} running
    </span>
  );
})()}
```

This: shows a red badge when there's something needing attention on mobile, falls back to "N running" when all is well. Hidden on desktop (md+).

**Step 3: Verify no TypeScript errors**

Run:
```bash
cd /Users/michaelenriquez/Code/war-room && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors.

**Step 4: Build check**

Run:
```bash
cd /Users/michaelenriquez/Code/war-room && npm run build 2>&1 | tail -15
```
Expected: Build completes, no errors.

**Step 5: Commit**

```bash
cd /Users/michaelenriquez/Code/war-room
git add app/dashboard/page.tsx
git commit -m "fix(mobile): show attention badge in header on small screens"
```

---

## Final Verification

After all 3 tasks complete:

**Step 1: Full build**
```bash
cd /Users/michaelenriquez/Code/war-room && npm run build 2>&1 | tail -20
```
Expected: ✓ Compiled successfully, 0 errors.

**Step 2: TypeScript clean**
```bash
cd /Users/michaelenriquez/Code/war-room && npx tsc --noEmit 2>&1
```
Expected: No output (zero errors).

**Step 3: Manual spot check (Chrome DevTools)**
- Open dashboard → toggle to iPhone 14 Pro (390×844)
- StatusRibbon: should show 2-column grid, all cards visible
- TerminalPanel: should start collapsed
- Header: should show "N need attention" badge (red) or "N running" (dim)
- Toggle desktop view → existing layout preserved

**Step 4: Push + PR**
```bash
cd /Users/michaelenriquez/Code/war-room
git push -u origin feature/mobile-dashboard-m1
gh pr create --title "fix(mobile): Dashboard M1 — ribbon grid, terminal collapse, header badge" --body "First mission toward Mobile-Ready Dashboard objective.

- StatusRibbon: 2-col grid on mobile (<640px), scroll preserved on tablet+
- TerminalPanel: collapsed by default on mobile (<768px), follows existing SSR pattern
- Header: attention badge on mobile, full stats bar on desktop unchanged"
```

---

## What This Does NOT Fix (Future Missions)

- Objective kanban columns: still scroll horizontally on mobile (fine for now — it's usable)
- Touch target audit: buttons are already 8×8 or 10×10 Tailwind units (32-40px) — borderline, but acceptable for v1
- PWA install prompt: service worker + manifest are wired, but no install prompt UI
- Offline state: `/offline` route exists but needs styling

These are scoped to future missions in the Mobile-Ready Dashboard objective.
