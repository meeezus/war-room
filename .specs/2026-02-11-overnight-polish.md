# Overnight Polish: Dashboard cleanup, table view, richer mission cards

## Context

The War Room dashboard is overwhelming — Mission Queue takes up too much space on the main view and missions in projects lack meaningful detail. Clicking a mission card shows just "running" or "queued" with no context about what it actually does. The user wants: (1) remove Mission Queue from dashboard, (2) table view toggle alongside kanban, (3) richer mission cards with descriptions/goals, (4) cleaner less spammy UI, (5) everything up to date.

## Experience Outcome

When I open the dashboard, it's clean — no giant mission queue. I click into a project and toggle between kanban and table view. The table view shows missions in rows with status, agent, progress, dates — like Obsidian. Clicking any mission shows real detail: what it is, what the goal is, what steps are involved. The event feed shows what agents worked on overnight.

## File Inventory

| File | Lines | Action |
|------|-------|--------|
| `app/dashboard/page.tsx` | 227 | modify — remove Mission Queue section |
| `components/project-detail.tsx` | 131 | modify — add kanban/table view toggle |
| `components/project-kanban.tsx` | 130 | modify — wrap in view mode context |
| `components/mission-kanban-card.tsx` | 163 | modify — richer expanded detail (description, goal, steps) |
| `components/mission-table-view.tsx` | ~120 | create — table view component |
| `lib/queries.ts` | ~400 | modify — fetch mission descriptions from proposals |

## Dependencies

None — all UI changes using existing Tailwind + motion/react.

## Data Notes

Missions don't have their own `description` field — the description lives on the linked `Proposal`. To show meaningful detail in mission cards, we need to join through `proposal_id` to get `proposals.description`. The `result` JSON field on missions may also contain useful output info.

---

## Sprint 1: Dashboard Cleanup

### S1-T1: Remove Mission Queue from dashboard
**Model:** sonnet

**Outcome:** The Mission Queue section (lines 138-148 in `app/dashboard/page.tsx`) is removed. The `MissionQueue` import and `getMissions` call can stay (missions data still used for stats), but the visual section is gone.

**Files:**
- `app/dashboard/page.tsx` (modify — remove Mission Queue JSX block)

**Acceptance:**
- **Given** the dashboard loads
- **When** there are queued/running missions
- **Then** no Mission Queue section appears on the dashboard

---

## Sprint 2: Richer Mission Cards

### S2-T1: Add proposal description to mission queries
**Model:** sonnet

**Outcome:** `getProjectMissionsWithSteps()` also fetches the linked proposal's description and returns it alongside each mission. The `MissionWithSteps` interface gains `description: string | null`.

**Approach:**
- After fetching missions, batch-fetch their linked proposals to get descriptions
- Add `description` to `MissionWithSteps` interface in `mission-kanban-card.tsx`

**Files:**
- `lib/queries.ts` (modify — join proposal description)
- `components/mission-kanban-card.tsx` (modify — update interface)

**Acceptance:**
- **Given** a mission linked to a proposal with a description
- **When** `getProjectMissionsWithSteps()` is called
- **Then** each mission includes the proposal's description

### S2-T2: Richer expanded mission card
**Model:** sonnet

**Outcome:** When a mission card is expanded, it shows: description (from proposal), goal (from proposal), step summary (e.g. "3 research, 2 code, 1 review"), and result summary if completed. Much more informative than just dates.

**Files:**
- `components/mission-kanban-card.tsx` (modify — richer expanded section)

**Acceptance:**
- **Given** a mission card with a linked proposal description
- **When** the card is expanded
- **Then** shows description, step types, and result summary

---

## Sprint 3: Table View Toggle

### S3-T1: Create MissionTableView component
**Model:** sonnet

**Outcome:** A table/list view component showing missions as rows. Columns: Status (dot), Title, Agent, Progress (bar), Created, Duration. Sortable by clicking column headers. Matches the Obsidian table aesthetic — compact, scannable, monospace data.

**Files:**
- `components/mission-table-view.tsx` (create)

**Acceptance:**
- **Given** an array of MissionWithSteps
- **When** rendered
- **Then** shows a clean table with sortable columns

### S3-T2: Add view toggle to project detail
**Model:** sonnet

**Outcome:** Project detail page has a kanban/table toggle button next to the "Missions" label. Default: kanban. Toggle persists in localStorage. Both views show the same data.

**Files:**
- `components/project-detail.tsx` (modify — add toggle, conditionally render kanban or table)

**Acceptance:**
- **Given** the project detail page
- **When** I click the table toggle
- **Then** missions switch from kanban columns to table rows
- **When** I refresh
- **Then** the last-used view mode is preserved

---

## Execution

| Group | Tasks | Parallel |
|-------|-------|----------|
| A | S1-T1, S2-T1, S2-T2 | Yes |
| B | S3-T1, S3-T2 | Yes, after A |

## Rollback

- Revert dashboard to include Mission Queue
- Remove table view component, revert project-detail toggle

## Out of Scope

- Drag-and-drop in table view
- Filtering/search in table view
- RPG game-style redesign (separate sprint)
- Deleting mission-queue component file

## Verification

1. `npm run build` passes
2. Dashboard has no Mission Queue section
3. Project detail shows kanban/table toggle
4. Expanded mission cards show description and step types
5. Table view shows sortable rows with all mission data
