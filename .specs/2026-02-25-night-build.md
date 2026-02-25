# Night Build: Discovery Browser + Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a fully functional Discovery Browser page and clean up overnight sprint artifacts.

**Architecture:** Discovery infrastructure already exists (table, queries, types, action endpoint). We're building the UI layer: an API route for listing/filtering discoveries, a client page with filter controls and approve/dismiss actions, and a link from the dashboard PatrolCard.

**Tech Stack:** Next.js 15, Tailwind CSS (semantic classes only), Supabase

**Branch:** `feature/discovery-browser`

**Verification:** `npm run build` passes after all tasks.

---

## Sprint 0: Git Cleanup

### S0-T1: Close PR #10 and create fresh branch

**Model:** sonnet | **Parallel:** Group 0

Close the overnight PR (partial/messy), switch to main, create clean branch.

```bash
gh pr close 10 --comment "Superseded by clean implementation"
git checkout main && git pull origin main
git checkout -b feature/discovery-browser
```

---

## Sprint 1: Discovery Browser (all independent — spawn simultaneously)

### S1-T1: GET /api/discoveries route

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When I visit /discoveries, I want filtered patrol findings so I can review and action them.

**Outcome:** API route that fetches discoveries with optional filters.

**API Contract:**
```
GET /api/discoveries?status=pending&severity=critical&repo=war-room
Response: { discoveries: Discovery[] }
```

**Files:**
- Create: `app/api/discoveries/route.ts`
- Read-only: `lib/supabase-server.ts` (service client pattern)
- Read-only: `lib/types.ts` (Discovery type at line 240)

**Implementation:**
1. Import `createServiceClient` from `@/lib/supabase-server`
2. Parse searchParams: `status`, `severity`, `repo` (all optional)
3. Build query: `from('discoveries').select('*').order('created_at', { ascending: false })`
4. Apply filters: `.eq('status', status)` if provided, same for severity/repo
5. Return `{ discoveries: data }`
6. Handle errors: return 500 with `{ error: message }`

**Acceptance:**
- **Given** discoveries exist in the database
- **When** I call GET /api/discoveries?status=pending
- **Then** I receive only pending discoveries, ordered newest first

---

### S1-T2: /discoveries page

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When I browse discoveries, I want to filter by severity and status and approve/dismiss findings inline.

**Outcome:** Client page with filter bar + discovery list + action buttons.

**Files:**
- Create: `app/discoveries/page.tsx`
- Read-only: `lib/types.ts` (Discovery type)
- Read-only: `app/api/brief/action/route.ts` (approve/dismiss contract)
- Read-only: `components/breadcrumb.tsx` (reuse pattern)

**Implementation:**

Page layout:
```
Breadcrumb: Dashboard → Discoveries
Filter bar: [Pending] [Approved] [Dismissed] | severity: ◆Critical △Warning ○Info
Discovery list (cards):
  [severity icon] Title — category badge — repo — agent — timeAgo
  [Approve] [Dismiss] buttons (only on pending)
```

State:
- `discoveries: Discovery[]` — fetched from `/api/discoveries`
- `statusFilter: 'pending' | 'approved' | 'dismissed'` — default 'pending'
- `severityFilter: Set<string>` — all selected by default
- `loading: boolean`

Fetch pattern: `useEffect` triggers fetch when filters change. URL: `/api/discoveries?status=${statusFilter}&severity=${severityFilter}`.

Approve/Dismiss: POST to `/api/brief/action` with `{ discovery_id, action: 'approve' | 'dismiss' }`. Optimistic update: remove from list or update status badge.

Severity icons (inline, not imported):
- critical: red diamond `◆` with `text-red-400`
- warning: amber triangle `△` with `text-amber-400`
- info: blue circle `○` with `text-blue-400`

Style constraints:
- `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground` — NO zinc classes
- Use `StealthCard` if available, otherwise plain cards with `bg-muted border border-border rounded-lg`
- Match existing page patterns (see `/objectives` page, `/brief` page)

**Acceptance:**
- **Given** I'm on /discoveries
- **When** I click the "Pending" tab and toggle severity filters
- **Then** the list filters in real-time, showing only matching discoveries
- **When** I click "Approve" on a discovery
- **Then** it's optimistically moved to approved and POST fires to brief/action

---

### S1-T3: PatrolCard discovery link

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When I see the patrol card on the dashboard, I want to click through to see all discoveries.

**Outcome:** PatrolCard in status-ribbon.tsx links to /discoveries.

**Files:**
- Modify: `components/status-ribbon.tsx` (PatrolCard function, ~line 120-150)

**Implementation:**
1. Import `Link` from `next/link`
2. Wrap the discovery count or add a "View all →" text link below the patrol info
3. Link to `/discoveries`
4. Follow ObjectivesCard pattern (it links to `/objectives`)

**Acceptance:**
- **Given** I'm on the dashboard
- **When** I click the PatrolCard or its "View all" link
- **Then** I navigate to /discoveries

---

## Sprint 2: Shogunate Commit

### S2-T1: Commit shogunate overnight changes

**Model:** sonnet | **Parallel:** Group 2

**JTBD:** The overnight sprint made 3 verified-good changes to shogunate. Commit them.

**Outcome:** Changes committed on feature/makima-coo branch.

**Files (in ~/Code/shogunate/):**
- `engine/evaluator.py` — reflexive proposal for stalled objectives
- `engine/patrol.py` — parallelized scanning + severity validation
- `engine/skill_evolution.py` — batched DB operations

```bash
cd ~/Code/shogunate
git add engine/evaluator.py engine/patrol.py engine/skill_evolution.py
git commit -m "feat: reflexive proposals, parallel patrol, batched skill evolution

- Stalled objectives auto-propose initial/follow-up missions via LLM
- Patrol scanning parallelized with ThreadPoolExecutor(4)
- Added severity/category validation on patrol findings
- Batched patch updates and sunset resets in skill_evolution

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Execution Table

| Task | Group | Model | Est. Files | Independent? |
|------|-------|-------|-----------|-------------|
| S0-T1: Git cleanup | 0 | n/a | 0 | Blocker |
| S1-T1: API route | 1 | sonnet | 1 | Yes |
| S1-T2: Page | 1 | sonnet | 1 | Yes |
| S1-T3: PatrolCard link | 1 | sonnet | 1 | Yes |
| S2-T1: Shogunate commit | 2 | n/a | 0 | After Group 1 |

**Swarm verdict:** Hybrid — S0 sequential (git setup), S1 parallel (3 agents), S2 sequential (commit).

## Rollback

Per task — `git checkout -- <file>` reverts any individual task. No migrations, no schema changes.

## Verification

```bash
npm run build                    # types + imports
curl localhost:3000/api/discoveries  # API returns JSON
```

Manual: visit /discoveries, filter by status/severity, approve a discovery, check PatrolCard links.
