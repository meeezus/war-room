# Autonomous Discovery Loop + Agent Skill Evolution

## Experience Outcome

When I wake up, a visual morning brief is waiting — showing what the Daimyo found overnight. Ed flagged 3 stale TODOs in Folio, Armin found a dependency vulnerability, Nanami noticed Claude API costs spiked 40%. I tap "approve" on two items in Shoin Chat, Makima creates missions, the engine executes. Over time, the proposals get sharper because the system learns what I approve and reject. Meanwhile, each Daimyo's SKILL file evolves — Ed gets better at TypeScript patterns because his successful approaches get extracted and appended after every mission.

## Context

**Problem:** The Shogunate engine executes well but doesn't *discover*. Every mission starts because Sensei thinks of it. The system is reactive.

**Why now:** Pulse (Sprint 1-3) just shipped — Makima has engine awareness, action routing, and proactive alerts. The cron trigger pattern works (systemEvent → main session). All the pipes exist. We're wiring, not building.

**Intended outcome:** Two compounding systems — one that finds work (Discovery), one that learns from work (Skill Evolution). Together they close the loop: discover → execute → learn → discover better.

**Also:** Fix the Shoin Chat "Load failed" bug — token mismatch + missing stream timeout.

---

## Sprint 0: Chat Fix (Unblock Shoin Chat)

### S0-T1: Fix OpenClaw token + add stream timeout [DONE]

**Model:** sonnet | **Parallel:** Group 0

**JTBD:** When I chat with any agent in Shoin Chat, the chat should respond (or fail fast) instead of hanging forever.

**Outcome:** Fix the token mismatch in `.env.local` and add a timeout to the WebSocket stream reader so hangs become visible errors instead of infinite waits.

**Acceptance:**
- **Given** dev server running with corrected token
- **When** I send a message to Makima in Shoin Chat
- **Then** response streams back OR error appears within 30s (not infinite hang)

**Files:**
- `.env.local` (modify — update `OPENCLAW_GATEWAY_TOKEN` to `22ebaf95dc2ebae174ccda62322589c1ca4a3aa0eb580df7`)
- `lib/openclaw-client.ts` (modify — add 30s connection timeout to WebSocket)
- `app/api/chat/route.ts` (modify — add AbortController timeout around `reader.read()`)

---

## Sprint 1: Nightly Patrol (Discovery Engine)

### S1-T1: Create discoveries table + migration [DONE]

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When patrol agents find issues, those findings persist in a structured table for morning review.

**Outcome:** New `discoveries` table in Supabase with status workflow (pending → approved/dismissed), source agent, severity, and feedback tracking.

**Data Model:**
```sql
CREATE TABLE discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,          -- which Daimyo found it
  category TEXT NOT NULL,          -- 'code_health' | 'dependency' | 'performance' | 'cost' | 'opportunity'
  severity TEXT DEFAULT 'info',    -- 'critical' | 'warning' | 'info'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  repo TEXT,                       -- which codebase
  file_path TEXT,                  -- specific file (optional)
  evidence TEXT,                   -- supporting data
  suggested_action TEXT,           -- what to do about it
  status TEXT DEFAULT 'pending',   -- 'pending' | 'approved' | 'dismissed' | 'executed'
  feedback TEXT,                   -- why dismissed (trains future filter)
  proposal_id UUID REFERENCES proposals(id), -- linked proposal if approved
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_discoveries_status ON discoveries(status);
CREATE INDEX idx_discoveries_agent ON discoveries(agent_id);
```

**Files:**
- `supabase/migrations/20260225000001_discoveries.sql` (create)
- `lib/types.ts` (modify — add Discovery type for frontend)
- `lib/realtime.ts` (modify — subscribe to `discoveries` table for live UI updates)

### S1-T2: Patrol trigger + engine module [DONE]

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When the nightly cron fires, Daimyo agents scan their domains and write findings to the discoveries table.

**Outcome:** New `engine/patrol.py` module that runs domain-scoped scans per Daimyo. Each agent gets a focused scan task: Ed scans code health, Armin scans dependencies/research, Nanami scans costs, Major scans ops/infra.

**Interface:**
```python
# engine/patrol.py
async def run_patrol() -> list[dict]:
    """Run nightly patrol across all Daimyo domains. Returns list of discoveries."""

async def _scan_domain(daimyo_id: str, domain: str, repos: list[str]) -> list[dict]:
    """Single agent scans their domain across specified repos."""
```

**Acceptance:**
- **Given** patrol triggered via poller `check_triggers()`
- **When** patrol runs
- **Then** each domain agent scans their scope, findings inserted to `discoveries` table with status='pending'
- **Then** events emitted: `patrol_started`, `discovery_created` (per finding), `patrol_complete` → all visible in War Room event feed

**Events emitted (via engine/events.py):**
- `patrol_started` → `{ agents: ["ed","armin","nanami","major"], repos: [...] }`
- `discovery_created` → `{ discovery_id, agent_id, category, severity, title }` (one per finding)
- `patrol_complete` → `{ discovery_count, duration_seconds, agents_scanned }`

**Files:**
**Model tier:** PATROL_MODEL = CHEAP_MODEL (Haiku) for scans. Sonnet only if discovery requires code-level analysis.

**Event batching:** Emit one `patrol_complete` event with full discovery array in metadata (not individual `discovery_created` per finding). Event feed renders as expandable card.

**Post-deploy:** After poller.py changes, restart plist:
```bash
launchctl unload ~/Library/LaunchAgents/com.warroom.poller.plist && launchctl load ~/Library/LaunchAgents/com.warroom.poller.plist
```

**Files:**
- `~/Code/shogunate/engine/patrol.py` (create — patrol orchestrator, emits batched events)
- `~/Code/shogunate/engine/poller.py` (modify — add `run_patrol()` call after triggers, gated by schedule)
- `~/Code/shogunate/engine/config.py` (modify — add PATROL_MODEL, PATROL_REPOS, PATROL_SCHEDULE constants)

### S1-T3: Pulse action type for discovery approval [DONE]

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When Makima presents discoveries in chat, I can approve/dismiss inline and the system acts on it.

**Outcome:** Two new Pulse action types: `approve_discovery` and `dismiss_discovery`. Approval creates a proposal and links it. Dismissal records feedback for future filtering.

**Interface:**
```typescript
// New PulseAction variants
| { type: 'approve_discovery'; discovery_id: string }
| { type: 'dismiss_discovery'; discovery_id: string; reason?: string }
```

**Acceptance:**
- **Given** Makima shows pending discoveries in chat
- **When** she responds with `[ACTION]{"type":"approve_discovery","discovery_id":"..."}[/ACTION]`
- **Then** discovery status → 'approved', linked proposal created, proposal enters normal engine flow

**Events emitted on action execution:**
- `discovery_approved` → `{ discovery_id, title, proposal_id }` — shows in event feed, proposal auto-enters engine pipeline
- `discovery_dismissed` → `{ discovery_id, title, reason }` — logged for feedback loop

**War Room integration:** Approved discoveries create proposals with `source='patrol'`. These flow through the normal engine pipeline: proposal → council review → mission → tasks. Every step emits events already (proposal_approved, mission_started, task_completed, etc.) so the **full lifecycle is visible in the event feed and dashboard automatically**.

**Files:**
- `lib/pulse-actions.ts` (modify — add approve_discovery + dismiss_discovery handlers + event emission)
- `lib/types.ts` (modify — add Discovery type)

---

## Sprint 2: Morning Brief (Visual Synthesis + War Room Integration)

### S2-T1: Morning brief API + HTML generator [DONE]

**Model:** sonnet | **Parallel:** Group 2

**JTBD:** When I open the War Room in the morning, a beautiful visual brief is waiting with discoveries, overnight activity, and priorities.

**Outcome:** New API endpoint that generates a self-contained HTML brief from overnight data. Includes: pending discoveries (by severity), overnight missions/events, priorities, and inline approve/dismiss buttons that call Pulse actions.

**API Contract:**
```
GET /api/brief/latest → { html: string, generated_at: string, discovery_count: number }
POST /api/brief/action → { discovery_id: string, action: 'approve' | 'dismiss', reason?: string }
```

**Acceptance:**
- **Given** patrol ran overnight with 5 discoveries
- **When** I hit GET /api/brief/latest
- **Then** returns styled HTML with discoveries grouped by severity, agent avatars, approve/dismiss buttons

**Files:**
- `app/api/brief/latest/route.ts` (create — fetch discoveries + events + generate HTML)
- `app/api/brief/action/route.ts` (create — handle approve/dismiss from brief)
- `lib/brief-generator.ts` (create — HTML generation with house palette)

### S2-T2: War Room dashboard integration [DONE]

**Model:** sonnet | **Parallel:** Group 2

**JTBD:** When I open the War Room, discoveries are visible alongside projects, missions, and events — not siloed in a separate view.

**Outcome:**
1. **Dashboard** — "Morning Brief" card with discovery count, severity breakdown, and link to full HTML brief
2. **Event feed** — patrol/discovery events stream live (realtime subscription on `events` table already exists)
3. **Agent sidebar** — shows patrol status: "Ed: scanning code_health" during patrol, "Ed: idle" otherwise
4. **Shoin Chat** — Makima auto-mentions pending discoveries in Pulse alerts
5. **Project cards** — if discoveries are linked to a project (via repo), show badge: "2 discoveries"

**Acceptance:**
- **Given** pending discoveries exist
- **When** I open the dashboard
- **Then** brief card shows discovery count + severity breakdown. Click opens full brief.
- **When** patrol is running
- **Then** agent sidebar shows scanning status, event feed shows patrol_started event live
- **When** I chat with Makima
- **Then** she mentions "3 overnight discoveries awaiting your review" in her first response

**Files:**
- `app/dashboard/page.tsx` (modify — add brief card + discovery badges on project cards)
- `components/brief-card.tsx` (create — summary card with link to full brief)
- `components/agent-sidebar.tsx` (modify — show patrol/scanning status from events)
- `components/event-feed.tsx` (modify — add patrol/discovery event rendering with agent avatars)
- `components/project-card.tsx` (modify — discovery badge count per project)
- `lib/pulse-alerts.ts` (modify — add pending discovery count to alerts)
- `lib/queries.ts` (modify — add `getDiscoveriesByProject()`, `getPendingDiscoveryCount()`)

### S2-T3: Feedback loop — discovery quality scoring [DONE]

**Model:** sonnet | **Parallel:** Group 2

**JTBD:** When I consistently dismiss a category of discovery, the system learns to deprioritize it.

**Outcome:** Track approve/dismiss ratios per agent, per category. Patrol module reads these scores to weight future scans. Simple exponential moving average.

**Files:**
- `~/Code/shogunate/engine/patrol.py` (modify — read feedback scores, weight scan priorities)
- `lib/queries.ts` (modify — add `getDiscoveryFeedbackStats()` query)

---

## Sprint 3: Agent Skill Evolution

### S3-T1: Post-mission skill extractor [DONE]

**Model:** sonnet | **Parallel:** Group 3

**JTBD:** When a mission completes, the system automatically extracts what the agent learned and stores it as a skill patch.

**Outcome:** New `engine/skill_evolution.py` module. After mission completion, analyzes task outputs via Haiku LLM to extract: patterns that worked, anti-patterns that failed, new domain knowledge. Stores as `skill_patches` in Supabase. **Deduplicates before insert** — compares new patch against existing patches for same agent using semantic similarity (cosine > 0.8 = merge/boost confidence instead of creating duplicate).

**Data Model:**
```sql
CREATE TABLE skill_patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  mission_id UUID REFERENCES missions(id),
  patch_type TEXT NOT NULL,        -- 'pattern' | 'anti_pattern' | 'domain_knowledge' | 'tool_preference'
  content TEXT NOT NULL,           -- the learned insight
  content_embedding VECTOR(1024),  -- for semantic dedup (optional, uses Voyage if available)
  confidence FLOAT DEFAULT 0.5,   -- 0-1, increases with repeated confirmation
  confirmation_count INT DEFAULT 1, -- times this pattern was independently observed
  applied BOOLEAN DEFAULT false,   -- has this been written to SKILL file?
  sunset_at TIMESTAMPTZ,           -- 90 days after creation; resets confidence if unconfirmed
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Interface:**
```python
# engine/skill_evolution.py
async def extract_skill_patches(mission_id: str) -> list[dict]:
    """Analyze completed mission, extract learnings per agent."""

async def apply_pending_patches(agent_id: str) -> int:
    """Write high-confidence patches to agent's SKILL.md. Returns count applied."""
```

**Acceptance:**
- **Given** mission completes with 3 tasks (2 success, 1 failure)
- **When** skill extractor runs
- **Then** successful patterns stored as skill_patches with confidence=0.5, failure stored as anti_pattern
- **Then** event emitted: `skill_patch_extracted` → visible in War Room event feed

**Events emitted:**
- `skill_patch_extracted` → `{ agent_id, mission_id, patch_type, content_preview }` (per patch)

**Files:**
- `~/Code/shogunate/engine/skill_evolution.py` (create — emits events via engine/events.py)
- `supabase/migrations/20260225000002_skill_patches.sql` (create)
- `~/Code/shogunate/engine/executor.py` (modify — call extract_skill_patches after mission completion, alongside existing evaluate_mission)
- `components/event-feed.tsx` (modify — render skill_patch events with agent avatar + pattern preview)

### S3-T2: Skill file updater + confidence gating [DONE]

**Model:** sonnet | **Parallel:** Group 3

**JTBD:** When a pattern has been confirmed across 3+ missions, it gets promoted into the agent's SKILL file automatically.

**Outcome:** Weekly cron (or manual trigger) that reads high-confidence patches (confidence >= 0.8 OR confirmed 3+ times) and appends them to the `## Learned Patterns` section of the SKILL.md file. Makima reviews cross-agent patterns and can cross-pollinate.

**Acceptance:**
- **Given** Ed has 3 skill_patches with confidence >= 0.8
- **When** weekly skill evolution runs
- **Then** patches appended to Ed-SKILL.md under `## Learned Patterns`, marked as `applied=true`
- **Then** event emitted: `skill_applied` visible in event feed ("Ed learned: always validate Supabase client before query")

**90-day sunset clause:** Same weekly cron checks `WHERE applied=false AND sunset_at < now()`, resets confidence to 0.5. Prevents stale unconfirmed patterns from accumulating.

**Events emitted:**
- `skill_applied` → `{ agent_id, patch_count, patches: [{type, content_preview}] }`
- `skill_sunset` → `{ agent_id, patch_count }` (when patterns aged out)

**Files:**
- `~/Code/shogunate/engine/skill_evolution.py` (modify — add apply_pending_patches, confidence boosting, sunset check)
- `~/Code/shogunate/skills/*.md` (modify — add `## Learned Patterns` section to each SKILL file)

### S3-T3: Cross-pollination via Makima [DONE]

**Model:** sonnet | **Parallel:** Group 3

**JTBD:** When multiple agents learn similar patterns, Makima synthesizes and shares the generalized insight across the fleet.

**Outcome:** Makima reviews recent skill_patches on demand, identifies patterns that apply across domains, and creates generalized entries. E.g., if Ed and Armin both learn "always check for null Supabase client" → becomes a fleet-wide pattern.

**Manual-first:** Triggered by `/evolve` command or `POST /api/skills/evolve` — not automated weekly cron yet. Goes automatic after 10 successful promotions validate signal quality.

**Events emitted:**
- `cross_pollination` → `{ source_agents: ["ed","armin"], pattern, target_agents: ["all"] }`

**Files:**
- `~/Code/shogunate/engine/skill_evolution.py` (modify — add cross_pollinate function, manual trigger)
- `app/api/skills/evolve/route.ts` (create — manual trigger endpoint)

---

## War Room Visibility (End-to-End Data Flow)

Everything wires into the existing War Room dashboard. No new pages needed — discoveries, patrols, and skill evolution surface through existing views:

```
Patrol runs (11pm)
  → patrol_started event → Event Feed (live)
  → Agent sidebar shows "Ed: scanning" (live)
  → discovery_created events → Event Feed (live)
  → patrol_complete event → Event Feed (live)

Morning (6am)
  → Dashboard Brief Card shows "5 discoveries" with severity breakdown
  → Makima Pulse alert: "5 overnight discoveries awaiting review"
  → Project cards show discovery badges: "Folio: 2 findings"

User approves discovery (Shoin Chat or Brief)
  → discovery_approved event → Event Feed
  → Proposal created (source='patrol') → Event Feed: "proposal_created"
  → Engine auto-approves → Event Feed: "proposal_approved"
  → Mission created → Dashboard mission kanban + Event Feed: "mission_started"
  → Tasks assigned to Daimyo → Dashboard tasks + Event Feed: "task_completed"
  → Mission completes → Event Feed: "mission_completed"
  → Skill patches extracted → Event Feed: "skill_patch_extracted"

Weekly skill evolution
  → skill_applied events → Event Feed: "Ed learned 3 new patterns"
  → cross_pollination events → Event Feed: "Fleet insight: always validate SB client"
```

**Key:** No new dashboard pages. Discoveries, patrols, and skill evolution are *events* that flow through the existing realtime event feed + agent sidebar + project cards. The only new UI components are the Brief Card (dashboard) and discovery rendering in the event feed.

---

## Execution Table

| Group | Tasks | Parallel? | Dependencies |
|-------|-------|-----------|--------------|
| 0 | S0-T1 (chat fix) | Solo | None — unblocks testing |
| 1 | S1-T1, S1-T2, S1-T3 | Yes (3 agents) | S0-T1 |
| 2 | S2-T1, S2-T2, S2-T3 | Yes (3 agents) | S1 complete |
| 3 | S3-T1, S3-T2, S3-T3 | Yes (3 agents) | S1 complete (shares DB) |

**Swarm verdict:** Hybrid — Groups 2 and 3 can run in parallel after Group 1.

---

## Dependencies

- No new npm packages needed (HTML generation is string templates)
- No new Python packages (Haiku LLM calls use existing claude CLI)
- Supabase migrations (2 new tables: discoveries, skill_patches)

## Assumptions

- OpenClaw gateway is running and accessible at ws://127.0.0.1:18789
- Shogunate poller is running via plist
- Correct gateway token: `22ebaf95dc2ebae174ccda62322589c1ca4a3aa0eb580df7`
- SKILL files are at `~/Code/shogunate/skills/` and writable by the engine

## Rollback

- **Sprint 0:** Revert .env.local token, revert route.ts timeout changes
- **Sprint 1:** Drop `discoveries` table, revert poller.py, remove patrol.py
- **Sprint 2:** Remove brief routes, revert dashboard, remove brief-generator.ts
- **Sprint 3:** Drop `skill_patches` table, revert executor.py, remove skill_evolution.py. SKILL files can be git-reverted.

## Out of Scope

- Voice integration (approve via Siri/voice command) — defer until UX validated
- Multi-repo git integration (auto-PR from discoveries) — defer until patrol proves useful
- RPG stat integration (discoveries don't affect agent XP yet) — defer until Skill Evolution matures
- Frontend discovery browser/manager — defer until we know what views matter

## Verification

1. `npm run build` passes (war-room)
2. Send message in Shoin Chat → response streams back (S0)
3. Manually trigger patrol → discoveries appear in Supabase (S1)
4. `GET /api/brief/latest` returns HTML with discoveries (S2)
5. Complete a mission → skill_patches extracted (S3)
6. Approve discovery in chat → proposal created → engine picks it up (S1+S2)
