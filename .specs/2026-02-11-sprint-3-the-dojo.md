# Plan: Sprint 3 — The Dojo (Game-Style War Room)

## Context

Sprint 1 (infrastructure) and Sprint 2 (Shoin Chat) done. PR #5 on `feature/shoin-chat-rebuild`. Execution pipeline half-built (`engine/mission.py` raises `NotImplementedError`). User chose Concept B: The Dojo — top-down spatial room where you walk a character around, talk to agents, watch missions execute.

## Experience Outcome

I open War Room and see The Dojo — a dark room with my agents standing at stations. I push WASD/joystick to walk my character up to CC. I press A and a chat panel slides up — I tell CC to fix the auth middleware. CC walks to his workstation and starts working. The mission board on the wall shows progress bars filling up. Ed walks over to CC — they're collaborating. I walk to the mission board and see all active missions. I pull up the terminal drawer to run a quick git command. Everything happens in one place.

## Decision: Concept B — The Dojo

- Top-down 2D room with character movement (WASD/joystick/click)
- Agents positioned at stations with status indicators
- Walk up to agent + press A → chat panel slides up
- Mission board on wall → click to expand (kanban/table behind it)
- Terminal drawer at bottom (xterm.js, toggle with backtick)
- Canvas is OPTIONAL pull-out, not primary
- Shoin Chat remains as separate deep-planning page
- Emojis as Sprint 3 placeholders → real character art in Sprint 4
- Platform: web app now → Tauri desktop in Sprint 4

---

## Sprint 3A: Fix Execution Pipeline (3 tasks)

### S3A-T1: Fix engine paths + implement mission creation

**Outcome:** Approved proposals create missions + steps assigned to Daimyo by domain.

**Current:** `engine/mission.py` raises `NotImplementedError`. Engine path wrong in API routes (`~/Code/shogunate-engine` vs actual `war-room/engine/`).

**Files:**
- `engine/mission.py` (modify — implement `run_pending()` + `create_mission()`)
- `app/api/proposals/[id]/route.ts` (modify — fix `engineDir`)
- `engine/config.py` (read — use `DOMAIN_TO_DAIMYO` mapping)

**Acceptance:** Approve proposal → mission + steps created in Supabase → visible in UI. `npm run build` passes.

### S3A-T2: Test & fix mission executor

**Depends on:** S3A-T1

**Outcome:** Execute mission → steps run via Claude CLI → mission completes → events logged.

**Files:**
- `engine/executor.py` (fix if needed)
- `app/api/missions/[id]/execute/route.ts` (fix engineDir)
- `engine/config.py` (verify SKILL paths)

**Acceptance:** Mission executes end-to-end. Events emitted. Manual test.

### S3A-T3: Proposal creation from UI

**Depends on:** S3A-T1

**Outcome:** "New Proposal" button in project detail → form → creates proposal.

**Files:**
- `app/api/proposals/route.ts` (create — POST handler)
- `components/create-proposal-dialog.tsx` (create)
- `components/project-detail.tsx` (modify)

**Acceptance:** Create → approve → mission created. `npm run build` passes.

---

## Sprint 3B: The Dojo (3 tasks)

### S3B-T1: Dojo page layout + character movement

**Outcome:** `/dojo` page with top-down room, player character movement, agent sprites at stations.

**Implementation:**
- New page at `app/dojo/page.tsx`
- Player character moves with WASD/arrow keys/click (same as mockup)
- 7 agents positioned around room with status indicators (emoji sprites for now)
- Proximity detection — "Press A to talk" prompt when near agent
- Mission board element on the wall (static for now)
- Right sidebar: missions + event feed
- Dark theme: bg-zinc-950 floor with subtle grid, emerald accents
- Agent data from `getAgents()` query (existing)
- Realtime agent status updates via `useRealtimeAgents` (existing)

**Files:**
- `app/dojo/page.tsx` (create)
- `components/dojo/dojo-floor.tsx` (create — the room with grid, agents, player)
- `components/dojo/dojo-agent.tsx` (create — agent sprite with status ring)
- `components/dojo/dojo-player.tsx` (create — player character with movement)
- `components/dojo/mission-board.tsx` (create — wall element showing missions)

**Acceptance:** Page loads with room, player moves, agents visible with status, proximity detection works. `npm run build` passes.

### S3B-T2: Dojo chat panel

**Depends on:** S3B-T1

**Outcome:** Walk up to agent + press A → chat panel slides up from bottom. Connected to existing Claude CLI backend.

**Implementation:**
- Chat panel component slides up when triggered (same as mockup)
- Reuses existing chat infrastructure: `spawnClaude()` from `lib/claude-cli.ts`, `/api/chat/route.ts`
- Shows conversation with selected agent
- Voice button (placeholder — Spokenly integration later)
- Press B/Esc to close and return to walking
- Chat messages saved to `chat_messages` table (existing schema)

**Files:**
- `components/dojo/dojo-chat-panel.tsx` (create)
- `app/dojo/page.tsx` (modify — wire chat to agent interaction)

**Acceptance:** Walk up + press A → chat opens → can send messages → Claude responds via streaming → press B to close. `npm run build` passes.

### S3B-T3: Mission board wired to real data

**Depends on:** S3B-T1 + S3A-T1

**Outcome:** Mission board shows real missions from Supabase. Click to expand to full mission list.

**Implementation:**
- Board shows active missions with progress bars (from `getMissions()`)
- Click mission board → expand to overlay with full mission list
- Overlay can toggle between board view and table view (reuse existing components)
- Proposal scroll indicators when pending proposals exist
- Realtime updates via Supabase subscriptions

**Files:**
- `components/dojo/mission-board.tsx` (modify — wire to real data)
- `components/dojo/mission-board-overlay.tsx` (create — expanded view)
- `app/dojo/page.tsx` (modify — overlay state)

**Acceptance:** Board shows real missions. Click expands. Progress updates in real-time. `npm run build` passes.

---

## Sprint 3C: RPG Agent System (3 tasks)

### S3C-T1: RPG stat computation + role cards

**Outcome:** `getRpgStats(agentId)` returns real stats from Supabase. Role card configs for all 7 agents.

**Stats:**
| Stat | Source | Formula |
|------|--------|---------|
| TRU | Mission success rate | `clamp(successRate * 99, 0, 99)` |
| SPD | Avg step completion time | `clamp(99 - (avgHours/24)*99, 0, 99)` |
| WIS | Events + missions count | `clamp(log10(count) / log10(200) * 99, 0, 99)` |
| PWR | Missions completed | `clamp(min(completed/20, 1) * 99, 0, 99)` |

**Files:**
- `lib/rpg-stats.ts` (create)
- `lib/role-cards.ts` (create)
- `lib/types.ts` (modify — add RpgStats, RoleCard types)

**Acceptance:** Returns real stats with baseline fallback. `npm run build` passes.

### S3C-T2: RPG stats in dojo agent interaction

**Depends on:** S3C-T1 + S3B-T1

**Outcome:** Click/hover agent in dojo → see RPG stats, class, level. Status ring color matches.

**Files:**
- `components/dojo/dojo-agent.tsx` (modify — add stat tooltip/popup)
- `components/dojo/agent-stat-popup.tsx` (create)
- `lib/queries.ts` (modify — add RPG stat fetching)

**Acceptance:** Click agent → popup with name, class, level, 4 stat bars, current mission. `npm run build` passes.

### S3C-T3: Agent detail page — character sheet

**Outcome:** `/agents/[id]` shows full RPG character sheet.

**Files:**
- `app/agents/[id]/page.tsx` (modify — RPG layout)
- `components/rpg-stat-bar.tsx` (create)
- `lib/role-cards.ts` (read)

**Acceptance:** Full character sheet with stats, role card panels, mission history. `npm run build` passes.

---

## Execution Plan (Team/Swarm)

### Group A — Parallel (no dependencies)
| Task | Agent Model | Notes |
|------|-------------|-------|
| S3A-T1 | sonnet | Fix engine + mission creation (Python) |
| S3B-T1 | sonnet | Dojo page layout + movement (main UI work) |
| S3C-T1 | sonnet | RPG stats + role cards (lib modules) |

### Group B — After Group A
| Task | Agent Model | Depends On |
|------|-------------|------------|
| S3A-T2 | sonnet | S3A-T1 |
| S3A-T3 | sonnet | S3A-T1 |
| S3B-T2 | sonnet | S3B-T1 |
| S3C-T2 | sonnet | S3B-T1 + S3C-T1 |

### Group C — After Group B
| Task | Agent Model | Depends On |
|------|-------------|------------|
| S3B-T3 | sonnet | S3B-T1 + S3A-T1 |
| S3C-T3 | sonnet | S3C-T1 + S3C-T2 |
| Build verify | — | All |

**Total: 9 tasks across 3 groups. Swarm execution.**

## Constraints

- `npm run build` must pass after every task
- Dark theme: bg-zinc-950, emerald accents, Space Grotesk headings, JetBrains Mono data
- RPG stats from real Supabase data, baseline fallback
- Emojis as sprite placeholders (real art Sprint 4)
- Keep existing dashboard + Shoin Chat working
- No Three.js (Sprint 4)
- No new npm deps without checking installed packages first

## Deferred

- Terminal drawer (xterm.js) — Sprint 3.5 or 4
- 3D avatars (Tripo AI + React Three Fiber) — Sprint 4
- Agent-to-agent visible conversations — Sprint 4
- Controller joystick input (Gamepad API) — Sprint 4
- Spokenly voice integration — Sprint 4
- Autonomous agent execution loop — Sprint 4
- Chat → proposal bridge — Sprint 4
- Real character art — Sprint 4

## Verification

- **Pipeline:** Create proposal → Approve → Mission created → Execute → Complete → Events logged
- **Dojo:** Walk around room → agents visible with status → walk up + talk → chat works → mission board shows real data
- **RPG:** Click agent → stat popup → click "View Sheet" → full character sheet with real stats
- **Existing:** Dashboard still works. Shoin Chat still works. `npm run build` passes.
