# War Room Briefing — Pip Agent

## What Is the War Room

A dynasty-wide command dashboard served at a web URL. It visualizes **all projects** across Shogunate, Folio, and personal work — not just agent ops. Think of it as the single pane of glass for everything the dynasty is building.

---

## Architecture

- **Frontend**: Next.js 16 (React 19, Tailwind v4) — static dashboard, no auth required for viewing
- **Backend**: Supabase PostgreSQL with Row Level Security
- **Realtime**: Supabase Realtime subscriptions — changes appear instantly on the dashboard
- **Write access**: Requires Supabase service role key (not the anon key)

---

## Supabase Schema

| Table | Count | Purpose |
|-------|-------|---------|
| `projects` | 16 | Dynasty-wide projects (Folio, Shogunate boards, personal) |
| `boards` | 14 | Organize tasks within projects |
| `tasks` | 74 | Work items with status: `active`, `todo`, `done`, `blocked`, `someday` |
| `agent_status` | 6 | Daimyo agents: Ed, Light, Toji, Power, Major, CC |
| `events` | — | Activity feed (`agent_action`, `system`, `proposal` types) |
| `proposals` | — | Submitted proposals from agents |
| `missions` | — | Shogunate engine missions |
| `steps` | — | Mission steps |
| `cap_gates` | — | Capability gates from Shogunate engine |

### Key relationships
- Projects contain boards, boards contain tasks
- Events reference agents by name
- Agent status tracks each agent's current state (busy, idle, offline)

---

## CC Agent (Claude Code)

CC is the only agent currently writing to Supabase. Here's how it works:

- Runs in terminal as the "CC" agent
- Auto-updates the dashboard via **PostToolUse hooks**:
  - `ExitPlanMode` → `plan-sync.sh` → sets CC to busy, creates tasks from the approved plan
  - `Bash` (on git commit) → `commit-sync.sh` → fires events into the activity feed
- Uses `engine/war-room-api.sh` — a curl wrapper pre-loaded with the service role key
- Has a `/war-room` skill for manual overrides (status changes, event posting)

---

## Dashboard Views

- **Kanban**: Shows tasks (not projects) flowing through columns: Active → Todo → Done → Blocked → Someday
- **Event Feed**: Scrolling feed of agent actions, commits, system events — updates in realtime
- **Stats Bar**: Counts of tasks by status, active agents
- **Agent Sidebar**: Shows each Daimyo agent's current status and last action

---

## Pip's Potential Role

You could integrate with the War Room to:

- **Route Discord requests** as proposals or events
- **Create tasks** from Discord conversations
- **Post events** when actions happen in Discord (e.g., user requests, decisions made)
- **Update your own agent status** to reflect what you're doing

### What you'd need
- `SUPABASE_URL` — the project URL
- `SERVICE_ROLE_KEY` — for write access (bypasses RLS)
- Knowledge of the REST API patterns below

---

## API Patterns

All writes use the Supabase REST API with the service role key for auth.

### Post an event

```bash
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

### Update agent status

```bash
curl -X PATCH "${SUPABASE_URL}/rest/v1/agent_status?name=eq.pip" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status": "busy", "current_task": "Processing Discord request"}'
```

### Create a task

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/tasks" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{
    "title": "Task from Discord",
    "status": "todo",
    "board_id": "<board-uuid>",
    "created_by": "pip"
  }'
```

### Create a proposal

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/proposals" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{
    "agent": "pip",
    "title": "Proposal from Discord discussion",
    "body": "Details here...",
    "status": "pending"
  }'
```

---

## Current State

- Dashboard is **live** and read-only for viewers (no auth to view)
- **CC is the only agent** currently writing to Supabase
- Realtime subscriptions make updates appear instantly on all connected clients
- Kanban shows tasks flowing through status columns
- Event feed shows agent actions, commits, system events in reverse chronological order
- You (Pip) are not yet registered in `agent_status` — would need a row inserted first

---

## Reference

- War Room codebase: `~/Code/war-room/`
- API wrapper: `engine/war-room-api.sh`
- Supabase types: `lib/types.ts`
- Realtime subscriptions: `lib/realtime.ts`
- Supabase client: `lib/supabase.ts`
