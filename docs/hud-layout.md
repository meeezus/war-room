# War Room HUD Layout Spec

Design spec for the unified Shogunate HUD — a real-time operational dashboard at `/hud` (or replacing the current dashboard root).

---

## Overall Layout

```
+------------------+-----------------------------+-------------------+
|  LEFT SIDEBAR    |      CENTER PANEL           |   RIGHT FEED      |
|  Agent Status    |      Mission Kanban         |   Events + Reviews |
|  ~280px          |      flex-1                 |   ~340px           |
+------------------+-----------------------------+-------------------+
```

- **3-column layout** using Tailwind CSS grid: `grid grid-cols-[280px_1fr_340px]`
- Dark theme consistent with dojo aesthetic: `bg-zinc-950` base, `zinc-900` cards, `zinc-800` borders
- Font: JetBrains Mono for data/stats, system sans-serif for labels
- Full viewport height: `h-screen overflow-hidden`

---

## Top Bar

Fixed bar spanning all 3 columns. Height: `h-14`.

```
[ Project Dropdown  ]  |  5 Active  |  3 In Progress  |  1 Review  |  2 Proposals  |  [o] Connected
```

### Elements

| Element | Source | Behavior |
|---------|--------|----------|
| **Project selector** | `getProjects()` | `<select>` dropdown. Filters all panels to selected project. "All Projects" default. |
| **Active agents** | `DashboardStats.activeAgents` | Count of agents with status `online` or `busy` |
| **In-progress tasks** | `DashboardStats.inProgressTasks` | Count of tasks with status `in_progress` |
| **Pending reviews** | `DashboardStats.pendingReviews` | Count of tasks with status `review` |
| **Pending proposals** | `DashboardStats.pendingProposals` | Count of proposals with status `pending` |
| **Connection indicator** | Supabase Realtime channel state | Green dot = connected, yellow = connecting, red = disconnected |

### Styling

- Background: `bg-zinc-900/80 backdrop-blur border-b border-zinc-800`
- Stats as pill badges: `bg-zinc-800 text-zinc-300 text-xs px-2 py-1 rounded-full`
- Active counts use accent colors (green for active, amber for in-progress, etc.)

---

## Left Sidebar: Agent Status

Width: `280px`. Full height below top bar. Scrollable if needed.

### Agent List

Render one card per Daimyo agent. Source: `getAgents()` + `useRealtimeAgents()`.

Reference `ROLE_CARDS` from `lib/role-cards.ts` for display metadata (name, title, domain, color, emoji).

#### Agent Card Layout

```
+------------------------------------------+
| [o] Ed           engineering    [====60%] |
|     The Architect                         |
|     Mission: Refactor auth module         |
+------------------------------------------+
```

| Field | Source | Display |
|-------|--------|---------|
| **Status ring** | `AgentStatus.status` | 12px circle. Colors: green (`#22c55e`) = idle/online, amber (`#f59e0b`) = busy, red (`#ef4444`) = failed/offline, gray (`#6b7280`) = offline |
| **Name** | `RoleCard.name` | Bold, `text-sm text-zinc-100` |
| **Domain badge** | `RoleCard.domain` | Pill: `text-[10px] px-1.5 py-0.5 rounded`, colored per `RoleCard.color` with 20% opacity background |
| **Title** | `RoleCard.title` | `text-xs text-zinc-500` |
| **Current mission** | Join `AgentStatus.current_mission_id` -> `missions.title` | `text-xs text-zinc-400 truncate`. Show only when busy. |
| **Completion %** | Count tasks with `mission_id` matching current mission, ratio of `done`/`completed` to total | Thin progress bar, `h-1 rounded-full`, fill color matches agent's `RoleCard.color` |

#### Card Styling

- Default: `bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 mb-2`
- Hover: `hover:border-zinc-700 hover:bg-zinc-900/60 cursor-pointer`
- Active/selected: `border-[agent-color]/40 bg-[agent-color]/5`

#### Expanded View (on click)

Clicking an agent card expands it inline (accordion style, not a modal).

Expanded content:
- **Recent missions** (last 5): title, status badge, completion time. Source: `getAgentWithHistory(id).missions`
- **Completion rate**: `missions_completed / total missions` as percentage
- **Last heartbeat**: relative time (`2m ago`). Source: `AgentStatus.last_heartbeat`

---

## Center Panel: Mission Kanban

Takes remaining horizontal space (`flex-1`). This is the primary view.

### Column Layout

4 columns, horizontal scroll on overflow:

```
| Queued | Running | Completed | Failed |
```

- Grid: `grid grid-cols-4 gap-3`
- Each column: `bg-zinc-900/30 rounded-xl p-3 min-h-[200px]`
- Column header: status label + count badge

#### Column Headers

| Column | Filter | Header Color |
|--------|--------|-------------|
| Queued | `mission.status === 'queued'` | `text-zinc-400` |
| Running | `mission.status === 'running'` | `text-blue-400` |
| Completed | `mission.status === 'completed'` | `text-emerald-400` |
| Failed | `mission.status === 'failed'` | `text-red-400` |

### Mission Card

Source: `getMissions()` + `useRealtimeMissions()`.

```
+-----------------------------------+
| Refactor auth module              |
| [Ed]  [engineering]               |
| [====------] 2/5 tasks            |
| 3 hours ago                       |
+-----------------------------------+
```

| Field | Source | Display |
|-------|--------|---------|
| **Title** | `Mission.title` | `text-sm font-medium text-zinc-100 line-clamp-2` |
| **Assigned Daimyo** | `Mission.assigned_to` -> `getRoleCard()` | Small avatar badge: colored dot + name, `text-xs` |
| **Task progress** | Fetch tasks via `getMissionTasks(mission.id)` or join. Count `done`+`completed` vs total. | Progress bar + fraction label: `"2/5 tasks"` |
| **Time** | `Mission.created_at` | Relative time, `text-[10px] text-zinc-500` |
| **Domain badge** | Inferred from assigned agent's domain | Same pill style as sidebar |

#### Card Styling

- Default: `bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 mb-2`
- Hover: `hover:border-zinc-700`
- Running cards: left border accent `border-l-2 border-l-blue-500`
- Failed cards: left border accent `border-l-2 border-l-red-500`

### Mission Expanded View (on click)

Clicking a mission card opens an inline drawer/overlay that expands below the card (or a slide-over panel from the right). NOT a separate page.

#### Expanded Content

```
+------------------------------------------+
| Mission: Refactor auth module             |
| Assigned: Ed  |  Status: running          |
| Started: 2026-02-13 14:30                 |
+------------------------------------------+
| Tasks:                                    |
| [x] Research existing patterns  (Ed)      |
|     research | completed | 2m             |
| [~] Write migration script      (Ed)      |
|     code | running | --                    |
| [ ] Review and test             (Ed)      |
|     review | queued | --                   |
+------------------------------------------+
```

**Task list** — source: `getMissionTasks(mission.id)` + realtime subscription on `tasks` table filtered by `mission_id`.

Each task row:

| Field | Source | Display |
|-------|--------|---------|
| **Status icon** | `Task.status` | Checkbox: empty (queued), spinner (running/in_progress), check (done/completed), X (failed) |
| **Title** | `Task.title` | `text-sm text-zinc-200` |
| **Kind badge** | `Task.kind` | Pill: `text-[10px]` — colors: research=purple, code=blue, review=amber, test=green, deploy=cyan, write=pink, analyze=indigo |
| **Daimyo** | `Task.daimyo` | `text-xs text-zinc-500` |
| **Status chip** | `Task.status` | Small colored chip matching column colors |
| **Output preview** | `Task.output` | First 3 lines, truncated. `text-xs text-zinc-500 font-mono`. Click to expand full output in a scrollable pre block. |
| **Error display** | `Task.error` | Red background block: `bg-red-950/40 border border-red-900 rounded p-2 text-xs text-red-300 font-mono`. Only shown for failed tasks. |

---

## Right Feed: Events + Reviews

Width: `340px`. Full height below top bar. Vertically scrollable.

### Event Feed

Source: `getEvents()` + `useRealtimeEvents()`. Newest first.

#### Event Row

```
14:32  [o] Mission started: Refactor auth (Ed)
14:30  [+] Proposal approved: Auth cleanup
14:28  [!] Task failed: Deploy script (Major)
```

| Field | Display |
|-------|---------|
| **Timestamp** | `HH:mm` format, `text-[10px] text-zinc-600 font-mono` |
| **Type indicator** | Colored dot/icon (see color mapping below) |
| **Message** | `Event.message`, `text-xs text-zinc-300 line-clamp-2` |
| **Agent** | `Event.agent` if present, `text-[10px] text-zinc-500` |

#### Event Color Mapping

| Event Type Pattern | Color | Dot |
|-------------------|-------|-----|
| `proposal_*` | Blue `#3b82f6` | Circle |
| `mission_completed`, `task_completed` | Green `#22c55e` | Check |
| `mission_failed`, `task_failed` | Red `#ef4444` | X |
| `council_reviewed` | Yellow `#eab308` | Star |
| `heartbeat` | Gray `#6b7280` | Pulse |
| `mission_started`, `task_started` | Cyan `#06b6d4` | Arrow |
| `agent_action`, `user_request` | Zinc `#a1a1aa` | Dot |

#### Heartbeat Collapsing

Heartbeat events (`type === 'heartbeat'`) are **hidden by default**. Show a toggle: `"Show heartbeats (12)"` at the bottom. Clicking reveals them inline.

#### Event Row Styling

- `py-2 px-3 border-b border-zinc-800/50`
- Hover: `hover:bg-zinc-900/40`
- New events animate in: `animate-in fade-in slide-in-from-top-1 duration-300`

### Council Review Cards

When an event has `type === 'council_reviewed'`, render an expanded review card instead of a simple row.

Source: The `Proposal.reviews` array (join via `Event.source_id` -> `proposals.id`).

```
+------------------------------------------+
| Council Review: Auth cleanup proposal     |
+------------------------------------------+
| Ed       [v] approve  "Looks solid"       |
| Light    [!] concern  "Need user data"    |
| Toji     [v] approve                      |
| Makima   [v] approve                      |
| Major    [v] approve  "Deploy plan ready" |
+------------------------------------------+
```

| Verdict | Icon | Color |
|---------|------|-------|
| `approve` | Checkmark | Green `#22c55e` |
| `concern` | Warning triangle | Yellow `#eab308` |
| `reject` | X mark | Red `#ef4444` |

- Notes are collapsible (show first 50 chars, click to expand)
- Card styling: `bg-zinc-900/60 border border-yellow-900/30 rounded-xl p-3 my-2`

---

## Proposals Section

Rendered below the Mission Kanban in the center panel, separated by a divider.

Alternatively, implement as a **tab** in the center panel: `[Missions] [Proposals]` toggle.

### Proposal List

Source: `getAllPendingProposals()` + realtime on `proposals` table.

```
+-------------------------------------------+
| Auth module cleanup                       |
| [engineering]  risk:low  ~$0.50           |
| Council: 4/5 approve, 1 concern           |
| [ Approve ]  [ Reject ]                  |
+-------------------------------------------+
```

| Field | Source | Display |
|-------|--------|---------|
| **Title** | `Proposal.title` | `text-sm font-medium text-zinc-100` |
| **Domain** | `Proposal.domain` | Domain pill (same style as elsewhere) |
| **Risk level** | `Proposal.risk_level` | Badge: low=green, medium=amber, high=red |
| **Cost estimate** | `Proposal.cost_estimate` | `$X.XX` format, `text-xs text-zinc-400` |
| **Council verdict** | `Proposal.reviews` | Inline verdict badges per agent (same icons as review cards). Show if `council_review === true`. |
| **Approve button** | Action | `bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg` |
| **Reject button** | Action | `bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-800` |

Approve/Reject buttons call Supabase to update `proposals.status` and `proposals.approved_by = 'sensei'`.

---

## Responsive Behavior

| Breakpoint | Layout |
|-----------|--------|
| **Desktop** (`>= 1280px`) | Full 3-column grid |
| **Tablet** (`768px - 1279px`) | 2-column: sidebar collapses to icon-only rail (`w-16`, show only status dot + agent initial), center + feed share remaining space |
| **Mobile** (`< 768px`) | Single column with bottom tab bar: `[Agents] [Missions] [Feed] [Proposals]`. Each tab shows one section full-width. |

### Sidebar Collapsed State (Tablet)

- Width: `64px`
- Show: colored status dot (12px) + first letter of agent name
- Hover: tooltip with full agent name + status
- Click: opens agent detail as a slide-over from left

### Tailwind Breakpoints

```tsx
// Container
<div className="grid grid-cols-1 md:grid-cols-[64px_1fr_340px] xl:grid-cols-[280px_1fr_340px] h-screen">
```

---

## Data Flow

All data is fetched server-side (Next.js server components or route handlers) and hydrated client-side with realtime hooks.

### Initial Load

```
Page load (server):
  getAgents()        -> initialAgents
  getMissions()      -> initialMissions
  getEvents(50)      -> initialEvents
  getStats()         -> initialStats
  getAllPendingProposals() -> initialProposals
```

### Realtime Subscriptions

| Table | Hook | Events |
|-------|------|--------|
| `agent_status` | `useRealtimeAgents()` | UPDATE, INSERT |
| `missions` | `useRealtimeMissions()` | UPDATE, INSERT |
| `events` | `useRealtimeEvents()` | INSERT |
| `tasks` | `useRealtimeTasks()` | UPDATE, INSERT (filtered by `mission_id` when expanded) |
| `proposals` | New hook needed: `useRealtimeProposals()` | UPDATE, INSERT |

### Missing Hooks (to create)

- **`useRealtimeProposals(initialProposals: Proposal[]): Proposal[]`** — subscribe to `proposals` table INSERT + UPDATE. Pattern matches existing hooks in `lib/realtime.ts`.
- **`useRealtimeStats(initialStats: DashboardStats): DashboardStats`** — recompute stats on any agent/task/proposal change. Could derive from other realtime data rather than a dedicated subscription.

### No Polling

All updates are event-driven via Supabase Realtime. Zero `setInterval` or `setTimeout` polling.

---

## Component Hierarchy

```
app/hud/page.tsx              (server component: fetch initial data)
  components/hud/
    hud-shell.tsx              (client: 3-column grid, realtime providers)
    hud-top-bar.tsx            (project selector, stats, connection)
    hud-agent-sidebar.tsx      (agent list + expanded detail)
    hud-agent-card.tsx         (single agent card)
    hud-mission-kanban.tsx     (4-column kanban board)
    hud-mission-card.tsx       (single mission card)
    hud-mission-detail.tsx     (expanded task list for a mission)
    hud-task-row.tsx           (single task within mission detail)
    hud-event-feed.tsx         (event list + review cards)
    hud-event-row.tsx          (single event row)
    hud-council-review.tsx     (expanded council review card)
    hud-proposal-list.tsx      (pending proposals with actions)
    hud-proposal-card.tsx      (single proposal card)
```

---

## Design Tokens

Consistent with dojo aesthetic. Use these across all HUD components.

```
Backgrounds:   bg-zinc-950 (page), bg-zinc-900/40 (cards), bg-zinc-900/80 (top bar)
Borders:       border-zinc-800 (default), border-zinc-700 (hover)
Text:          text-zinc-100 (primary), text-zinc-300 (secondary), text-zinc-500 (muted)
Font mono:     font-[family-name:var(--font-jetbrains-mono)]
Radius:        rounded-xl (cards), rounded-lg (buttons/badges), rounded-full (pills/dots)
Shadows:       shadow-lg (elevated panels), shadow-none (inline cards)
Transitions:   transition-colors duration-150
```

### Agent Colors (from `role-cards.ts`)

| Agent | Color | Usage |
|-------|-------|-------|
| Ed | `#3b82f6` (blue) | Domain badges, progress bars, border accents |
| Light | `#f59e0b` (amber) | Domain badges, progress bars, border accents |
| Toji | `#a855f7` (purple) | Domain badges, progress bars, border accents |
| Makima | `#ef4444` (red) | Domain badges, progress bars, border accents |
| Major | `#06b6d4` (cyan) | Domain badges, progress bars, border accents |
| CC | `#10b981` (emerald) | Domain badges, progress bars, border accents |
