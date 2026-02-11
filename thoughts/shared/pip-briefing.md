# War Room Briefing — Pip Agent

**Updated: 2026-02-11** (overnight polish session)

## What Is the War Room

A dynasty-wide command dashboard. Visualizes **all projects** across Shogunate, Folio, and personal work. Single pane of glass for everything the dynasty builds.

Now also available as a **native Mac desktop app** via Tauri.

---

## Architecture

- **Frontend**: Next.js 16 (React 19, Tailwind v4) — dark theme, glassmorphism cards
- **Backend**: Supabase PostgreSQL with Row Level Security
- **Realtime**: Supabase Realtime subscriptions — live updates
- **Desktop**: Tauri 2.x wrapping the Next.js app as a native Mac window
- **Write access**: Requires Supabase service role key

---

## What Changed (Feb 10-11 Overnight)

### Major: Mission-First Board
The dashboard no longer shows **tasks** in kanban columns. It now shows **missions** — the unit of work that agents actually execute. Every project view has a 4-column kanban:

| Column | Status | Color |
|--------|--------|-------|
| Queued | Waiting to execute | Gray |
| Running | Agent working on it | Blue |
| Completed | Done | Green |
| Failed | Error | Red |

**78 existing tasks were migrated to missions** via a one-time script. Each task got a linked proposal + mission.

### Major: Mission Queue Removed from Dashboard
The main dashboard no longer shows a Mission Queue. Missions live inside their projects — cleaner, less overwhelming.

### New: Table View
Project detail pages now have a **Board / Table toggle**. Table view shows missions as sortable rows (status, title, agent, progress, dates) — like Obsidian.

### New: Richer Mission Cards
Clicking a mission card in kanban now shows:
- **Description** (pulled from the linked proposal)
- **Step summary** (e.g. "3/5 completed")
- **Result summary** (if completed)
- **Dates** (created, started, done)

### New: Tauri Desktop App
War Room now runs as a native Mac app. `npm run tauri:dev` opens a Tauri window that auto-starts the Next.js server.

---

## Supabase Schema

| Table | Purpose |
|-------|---------|
| `projects` | Dynasty-wide projects |
| `boards` | Organize tasks within projects |
| `tasks` | Legacy work items (being superseded by missions) |
| `proposals` | Submitted proposals — contain description, domain, risk level |
| `missions` | **Primary work unit** — linked to proposals, assigned to agents |
| `steps` | Mission execution steps (research, code, review, test, deploy) |
| `agent_status` | Daimyo agents: Ed, Light, Toji, Power, Major, CC |
| `events` | Activity feed |
| `cap_gates` | Capability gates |

### Key relationships
- `proposals` → `missions` (1:1, proposal_id on mission)
- `proposals` → `projects` (via project_id)
- `missions` → `steps` (1:many, mission_id on step)
- Missions are linked to projects **through proposals** (not directly)

### Mission lifecycle
1. Proposal created (pending) → appears in project's Proposals section
2. Proposal approved → mission auto-created (queued)
3. Mission executed → status changes to running, steps created
4. Steps complete → mission marked completed/failed

---

## Dashboard Views

### Main Dashboard (`/dashboard`)
- **Stats Bar**: Active agents, in-progress tasks, pending reviews, pending proposals
- **Project Overview**: Cards for each project with status, priority, task/mission counts
- **Agent Sidebar** (collapsible): Daimyo council status
- **Event Feed** (collapsible): Live scrolling feed of agent actions

### Project Detail (`/projects/[id]`)
- Project header with goal, status, type, owner
- **Proposals section**: Pending proposals with approve/reject
- **Mission progress bar**: X/Y missions completed
- **Board/Table toggle**: Switch between kanban and table view
- **Kanban**: 4 columns (queued → running → completed → failed), expandable cards
- **Table**: Sortable rows with status dot, title, agent, progress bar, dates

### Mission Detail (`/missions/[id]`)
- Full mission info with all steps listed

---

## CC Agent (Claude Code)

CC writes to Supabase via PostToolUse hooks:
- `ExitPlanMode` → plan-sync → sets CC to busy, creates tasks
- `Bash` (on git commit) → commit-sync → fires events

Also has `/war-room` skill for manual status changes and event posting.

---

## Pip's Role

You can integrate with the War Room to:

- **Route Discord requests** as proposals
- **Post events** when actions happen in Discord
- **Update your agent status** to reflect what you're doing
- **Create proposals** that appear in the War Room for Sensei to approve

### API Patterns

All writes use Supabase REST API with service role key:

```bash
# Post an event
curl -X POST "${SUPABASE_URL}/rest/v1/events" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{
    "type": "agent_action",
    "agent": "pip",
    "message": "Received task request from Sensei in Discord"
  }'
```

```bash
# Create a proposal (preferred over creating tasks directly)
curl -X POST "${SUPABASE_URL}/rest/v1/proposals" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "title": "Proposal from Discord discussion",
    "description": "Details here...",
    "source": "discord",
    "requested_by": "pip",
    "status": "pending",
    "project_id": "<project-uuid-if-known>"
  }'
```

```bash
# Update agent status
curl -X PATCH "${SUPABASE_URL}/rest/v1/agent_status?name=eq.pip" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status": "busy"}'
```

### What you need
- `SUPABASE_URL` — the project URL
- `SERVICE_ROLE_KEY` — for write access (bypasses RLS)

---

## Important: Confirm Understanding

**Sensei asked you to confirm that you understand this briefing.** When you next talk to him, acknowledge:

1. War Room is now mission-first (not task-first)
2. Dashboard no longer has a Mission Queue — missions live in projects
3. Projects have kanban + table view toggle
4. Mission cards show real detail (description from proposal, step progress, results)
5. Tauri desktop app exists now
6. Your role: route Discord → proposals, post events, update status

---

## Reference

- War Room codebase: `~/Code/war-room/`
- API wrapper: `engine/war-room-api.sh`
- Types: `lib/types.ts`
- Queries: `lib/queries.ts`
- Realtime: `lib/realtime.ts`
- Supabase client: `lib/supabase.ts`
