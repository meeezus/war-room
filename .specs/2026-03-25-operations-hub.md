# Operations Hub — Unified Spec

**Created:** 2026-03-25
**Branch:** `feature/operations-hub`
**Sources:** Handoff session notes, architect memory-dashboard plan, council matrix results (6-cell dual-axis consensus)

---

## Experience Outcome

When I open Tenshu or get my morning brief, I see what matters — not infrastructure jargon:

- **"2 skills improved today"** — the learning loop is visibly working
- **"Jack proposal ready, $4,200/mo"** — earn pipeline advancing
- **"3 research findings from Twitter"** — hunt is running
- **"Sleep 65, adjusted priorities"** — care is active
- **"Agents working: 3 active, 1 needs attention"** — fleet at a glance

Infrastructure health (sparkd, poller, bridge-worker) exists but lives in a collapsed "System Health" accordion — not the primary view. The PRIMARY content is organized by Sensei's five outcome categories: **Hunt, Earn, Guard, Care, Speak**.

---

## Context

### Problem

Tenshu v2 shows infrastructure metrics (cycle time, gateway status, insight counts) that Sensei called "jargon — not helpful, doesn't make sense." The dashboard was modeled after Mission Control's static metric layout, but what Sensei actually needs is visibility into autonomous agents producing business outcomes.

Meanwhile, the council matrix (6 cells, dual-axis, all agreeing) identified a deeper problem: **the recursive self-improvement loop is NOT closed.** Zero skill patches have been promoted to production. Spark captures, tab-ledger indexes, OpenSpace discovers — but nothing acts on it. The root cause is measurement absence: no baselines, no deltas, can't prove learning.

### Why now

1. The existing dashboard has broken imports (`getDashboardCounts`, `getRecentSessions`, `getRecentLogs` don't exist in `queries.ts`) — it may not build clean
2. Council matrix consensus: close the learning loop BEFORE building more dashboard. Intent journaling is ~50 lines and unblocks everything downstream.
3. The architect's probe library plan has valid backend architecture — keep it for system health, but shift the frontend from infrastructure stats to outcome categories

### What "useful" means (Sensei's words)

**NOT** "sparkd: ok" or "172 insights" or "cycle time: 8s."

**YES:**
- "Research agent found 3 new techniques from Twitter today" — click in, see plans, approve
- "Draft proposal for Jack ready — $4,200/mo" — review, send
- "Folio QA: fixed 2 bugs, 0 hallucinations in 24h" — confidence to promote
- "Oura: sleep 65, light day — top 3 priorities adjusted"
- "3 agents working, 1 needs your attention"
- "Here's what we learned today" — learnings feed

### Council matrix findings (dual-axis, all 6 cells agree)

**Root cause:** Measurement absence. No baselines means you can't prove learning, which means the self-improvement loop stays open.

**Ranked by cross-model agreement:**
1. **Intent Journaling** — PreToolUse hook predicts outcome, PostToolUse compares to reality. Delta = learning signal. ~50 lines.
2. **Session Autopsy** — Stop hook gathers deltas, extracts top 3 patterns, generates candidate patches, validates via replay, promotes or discards.
3. **Validation Gate** — Replay 3-5 historical scenarios before promoting a skill patch. Tab-ledger has the data.
4. **System Fitness Metric** — Weekly digest: "14 tasks, 3 corrections (down from 7), 2 skills improved."
5. **Toji Red Team Agent** — Reviews agent output, tries to break it, files vulnerability reports.
6. **External Knowledge Ingestion** — Periodic scan of community skills, Claude best practices.

### Key tensions

- **Build vs ship** — 80/20 split: 80% client work, 20% closing the loop
- **Infrastructure addiction vs revenue generation** — don't spend another week on plumbing
- **Three learning systems** (Spark, tab-ledger, OpenSpace) — consolidate or prove attribution

---

## File Inventory

| File | Lines (est) | Action | Sprint |
|------|-------------|--------|--------|
| `~/.claude/hooks/intent-journal-pre.sh` | ~30 | create | S0 |
| `~/.claude/hooks/intent-journal-post.sh` | ~40 | create | S0 |
| `~/.claude/hooks/session-autopsy.sh` | ~80 | create | S0 |
| `~/.spark/intent_deltas.jsonl` | — | created by hooks | S0 |
| `lib/local-services.ts` | ~200 | create | S1 |
| `lib/types.ts` | ~60 added | modify | S1 |
| `lib/queries.ts` | ~50 added | modify | S1 |
| `app/api/services/health/route.ts` | ~60 | create | S1 |
| `app/api/memory/status/route.ts` | ~80 | create | S1 |
| `app/api/activity/recent/route.ts` | ~80 | create | S1 |
| `components/outcomes/hunt-card.tsx` | ~80 | create | S2 |
| `components/outcomes/earn-card.tsx` | ~80 | create | S2 |
| `components/outcomes/guard-card.tsx` | ~70 | create | S2 |
| `components/outcomes/care-card.tsx` | ~70 | create | S2 |
| `components/outcomes/speak-card.tsx` | ~60 | create | S2 |
| `components/outcomes/learnings-feed.tsx` | ~90 | create | S2 |
| `components/widgets/system-health-accordion.tsx` | ~100 | create | S2 |
| `components/widgets/fleet-status.tsx` | ~80 | create | S2 |
| `app/dashboard/page.tsx` | ~200 | modify (heavy rewrite) | S2 |
| `lib/fitness-metric.ts` | ~120 | create | S3 |
| `app/api/fitness/weekly/route.ts` | ~80 | create | S3 |
| `tests/unit/local-services.test.ts` | ~80 | create | S3 |
| `tests/unit/intent-journal.test.ts` | ~60 | create | S3 |

## Dependencies

| Dependency | Type | Reason |
|------------|------|--------|
| `sqlite3` CLI | System (macOS built-in) | Read tab-ledger + lossless-claw DBs via `execFile` |
| Supabase | Internal (existing) | Engine status, missions, tasks, events |
| `child_process` | Node built-in | `launchctl list`, `sqlite3` |
| `fs/promises` | Node built-in | Read JSON heartbeat files, MEMORY.md stat |
| `~/.spark/cognitive_insights.json` | Local file | Insight count, learning metrics |
| `~/.tab-ledger/ledger.db` | Local SQLite | Session history for fitness metrics + validation gate |
| Claude hooks system | Infrastructure | PreToolUse, PostToolUse, Stop hooks for intent journaling |

## Assumptions

1. Claude hooks (`PreToolUse`, `PostToolUse`, `Stop`) execute shell scripts — verified working with existing hooks like oura-health-check.sh
2. `~/.spark/intent_deltas.jsonl` can be appended to by hooks and read by Spark's pipeline — JSONL is Spark's native event format
3. `sparkd` runs on port 8787 with `/status` endpoint (verified)
4. `sqlite3` CLI available on macOS (built-in)
5. `launchctl list` output format stable: `PID\tStatus\tLabel` (since macOS 10.6)
6. Tab-ledger DB at `~/.tab-ledger/ledger.db` with `cc_sessions` table (verified: 11,372 sessions)
7. Dashboard runs locally for real data; Vercel shows graceful "local-only" stubs for probes
8. Outcome categories (hunt/earn/guard/care/speak) initially populated from Supabase proposals + missions data, with stubs for future data sources (Oura, Twitter, invoice API)
9. The learning loop (intent journal → session autopsy → Spark) is the prerequisite — council matrix says ship this BEFORE the dashboard

---

## Sensei's Five Outcome Categories

These are the primary content lanes of the dashboard, replacing infrastructure metrics as the default view:

| Category | What it shows | Data source (v1) | Future data sources |
|----------|--------------|-------------------|---------------------|
| **Hunt** | Research findings, technique discoveries, Twitter/arxiv alerts | `discoveries` table, `proposals` where source = patrol/awareness | Twitter bookmarks API, arxiv RSS, Anthropic eng feed |
| **Earn** | Client proposals, invoice status, revenue pipeline | `proposals` where domain = commerce, `missions` with revenue tags | Invoice API, Stripe, Jack CRM |
| **Guard** | QA results, bug catches, security alerts, system health | `missions` where domain = operations/engineering + error count | Folio QA automation, Sentry, Toji red team reports |
| **Care** | Health scores, schedule, energy-based priority adjustment | Morning brief data, placeholder for Oura | Oura API, BJJ log, calendar |
| **Speak** | Morning brief status, Makima comms, voice interaction log | `war_room_events` where type = brief/notification | Discord bot events, voice transcripts |

---

## Sprints

### Sprint 0: Close the Loop

**Demo:** After a coding session, `~/.spark/intent_deltas.jsonl` contains prediction/outcome pairs. Session autopsy extracts top patterns and writes candidate skill patches. System fitness baseline established.

**Why first:** Council matrix #1 priority. All 6 cells agree: measurement absence is the root cause. This is ~170 lines of shell scripts and unlocks everything downstream. Without it, the dashboard would show infrastructure stats again because there are no learning outcomes to display.

---

#### S0-T1: Intent journaling hooks

**Model:** sonnet | **Parallel:** Group A

**JTBD:** When an agent uses a tool, I want the system to predict the outcome before execution and compare after, so that the delta between prediction and reality becomes a learning signal.

**Outcome:**
Two Claude hooks that create a prediction→outcome→delta pipeline:

1. `PreToolUse` hook (`~/.claude/hooks/intent-journal-pre.sh`):
   - Receives tool name + parameters via stdin (hook protocol)
   - Writes a prediction entry to `~/.spark/intent_deltas.jsonl`: `{ "id": uuid, "tool": name, "predicted_outcome": brief_prediction, "timestamp": iso8601, "session_id": $CLAUDE_SESSION_ID }`
   - Returns `{"decision": "allow"}` (never blocks execution)
   - Skips logging for high-frequency tools: Read, Glob, Grep (only journals Write, Edit, Bash)

2. `PostToolUse` hook (`~/.claude/hooks/intent-journal-post.sh`):
   - Receives tool name + result via stdin
   - Finds matching prediction by session_id + most recent entry for that tool
   - Appends outcome: `{ "id": matching_id, "actual_outcome": brief_summary, "delta": "match" | "partial" | "miss", "timestamp": iso8601 }`
   - Delta classification: compare predicted vs actual, flag misses for autopsy

3. Hook registration in `~/.claude/settings.json` (or project `.claude/settings.json`):
   - PreToolUse → `intent-journal-pre.sh`
   - PostToolUse → `intent-journal-post.sh`

**Acceptance:**
- **Given** a coding session where an agent runs `Edit` on a file
- **When** the session completes
- **Then** `~/.spark/intent_deltas.jsonl` contains at least one prediction/outcome pair with a delta classification

**Error Handling:**
| Scenario | UX | Recovery |
|----------|-----|---------|
| Hook script fails | Silent — never block tool execution | Log error to `~/.spark/intent_errors.log`, return allow |
| JSONL file locked | Skip write | Retry on next tool use |
| No matching prediction | Write outcome-only entry | Delta = "unpredicted" |

**Constraints:**
- Hooks MUST return in <100ms — no LLM calls, no network. Pure string matching + file append.
- Prediction is heuristic, not AI-generated: tool name + target file → expected pattern (e.g., Edit on .tsx → "component modification")
- JSONL format matches Spark's `events.jsonl` convention for pipeline compatibility

**Files:**
- `~/.claude/hooks/intent-journal-pre.sh` (create)
- `~/.claude/hooks/intent-journal-post.sh` (create)

---

#### S0-T2: Session autopsy hook

**Model:** sonnet | **Parallel:** Group A

**JTBD:** When a coding session ends, I want the system to analyze all deltas from that session, extract the top patterns, and generate candidate skill patches, so that learnings are captured automatically.

**Outcome:**
A `Stop` hook (`~/.claude/hooks/session-autopsy.sh`) that runs when a Claude Code session ends:

1. Reads `~/.spark/intent_deltas.jsonl`, filters to current session's entries
2. Counts: total predictions, matches, partials, misses
3. Groups misses by tool + file pattern to find repeated failure modes
4. If >=2 misses with same pattern: generates a candidate skill patch as markdown
5. Writes autopsy summary to `~/.spark/session_autopsies/YYYY-MM-DDTHHMMSS.json`:
   ```json
   {
     "session_id": "...",
     "total_predictions": 12,
     "matches": 9,
     "partials": 2,
     "misses": 1,
     "miss_rate": 0.083,
     "patterns": [...],
     "candidate_patches": [...],
     "fitness_delta": "+0.02"
   }
   ```
6. If candidate patches exist, writes them to `~/.spark/candidate_patches/` for validation gate (Sprint 3)

**Acceptance:**
- **Given** a session with 3 miss deltas on the same pattern (e.g., "Edit on queries.ts → type error")
- **When** the session ends and autopsy runs
- **Then** `session_autopsies/` contains a summary with `miss_rate`, and `candidate_patches/` contains a patch addressing the repeated failure

**Constraints:**
- Must complete in <5s — no LLM calls. Pattern extraction is string matching + frequency counting.
- Session autopsies are append-only. Never modify past autopsies.
- Candidate patches are proposals, not auto-applied. Validation gate (S3) decides promotion.

**Files:**
- `~/.claude/hooks/session-autopsy.sh` (create)
- `~/.spark/session_autopsies/` (directory, created by hook)
- `~/.spark/candidate_patches/` (directory, created by hook)

---

#### S0-T3: Fitness baseline + delta pipeline

**Model:** sonnet | **Parallel:** Group B (depends on T1, T2 for data format)

**JTBD:** When I want to know if the system is getting better, I want a fitness metric computed from session autopsies so I can see "miss rate dropped from 15% to 8% this week."

**Outcome:**
A script (`~/.claude/scripts/compute-fitness.sh`) that:

1. Reads all files in `~/.spark/session_autopsies/`
2. Computes rolling metrics:
   - Miss rate (7-day rolling average)
   - Correction count (from Spark's frustration/correction patterns)
   - Skills improved (count of promoted patches)
   - Session count
3. Writes to `~/.spark/system_fitness.json`:
   ```json
   {
     "computed_at": "iso8601",
     "period": "7d",
     "miss_rate": 0.12,
     "miss_rate_trend": "improving",
     "corrections": 3,
     "corrections_prev_period": 7,
     "skills_improved": 2,
     "sessions": 14,
     "digest": "14 tasks, 3 corrections (down from 7), 2 skills improved"
   }
   ```
4. This file becomes the data source for the dashboard's fitness widget and the morning brief's learning summary

**Acceptance:**
- **Given** 5 session autopsies exist spanning 3 days
- **When** `compute-fitness.sh` runs
- **Then** `system_fitness.json` contains a valid digest with rolling miss rate and trend

**Files:**
- `~/.claude/scripts/compute-fitness.sh` (create)
- `~/.spark/system_fitness.json` (created by script)

---

### Sprint 1: Backend — Probes, Types, Queries, API Routes

**Demo:** Hit `/api/services/health`, `/api/memory/status`, and `/api/activity/recent` locally — get real JSON. Dashboard query functions exist and return data. System fitness data is available.

*This sprint is adapted from the architect's memory-dashboard plan (Sprint 1). The probe library and API routes are valid as-is.*

---

#### S1-T1: Type definitions + fix broken query functions

**Model:** sonnet | **Parallel:** Group C

**JTBD:** When the dashboard fetches data, I want the query functions to exist and new types to be defined so the page doesn't error on import.

**Outcome:**
- Add `getDashboardCounts()`, `getRecentSessions(limit)`, `getRecentLogs(limit)`, `getTaskPipelineCounts()` to `lib/queries.ts`
- Add `ProbeResult`, `ServiceHealthResponse`, `MemoryStatusResponse`, `ActivityItem`, `ActivityFeedResponse`, `SystemFitness`, `OutcomeCard` types to `lib/types.ts`

**Interface:**
```typescript
// Probe types
export interface ProbeResult {
  ok: boolean;
  detail: string;
  latencyMs?: number;
  unavailable?: boolean;
  meta?: Record<string, unknown>;
}

export interface ServiceHealthResponse {
  overall: 'nominal' | 'degraded' | 'down' | 'unavailable';
  checkedAt: string;
  isLocal: boolean;
  services: Record<string, ProbeResult>;
}

export interface MemoryStatusResponse {
  checkedAt: string;
  isLocal: boolean;
  layers: Record<string, { ok: boolean; [key: string]: unknown }>;
}

export interface ActivityItem {
  source: 'spark' | 'tab_ledger' | 'makima' | 'poller' | 'engine';
  type: string;
  title: string;
  detail: string | null;
  timestamp: string;
}

export interface ActivityFeedResponse {
  isLocal: boolean;
  items: ActivityItem[];
}

// Outcome types (new — the primary dashboard content)
export interface SystemFitness {
  missRate: number;
  missRateTrend: 'improving' | 'stable' | 'degrading';
  corrections: number;
  correctionsPrevPeriod: number;
  skillsImproved: number;
  sessions: number;
  digest: string;
  computedAt: string;
}

export type OutcomeCategory = 'hunt' | 'earn' | 'guard' | 'care' | 'speak';

export interface OutcomeCard {
  category: OutcomeCategory;
  headline: string;
  detail: string | null;
  count: number;
  actionLabel?: string;
  actionHref?: string;
  items?: { title: string; timestamp: string; status?: string }[];
}
```

**Query functions:**
- `getDashboardCounts`: query `missions` (status=running → activeSessions), `agent_status` (status!=offline → agentsOnline), `tasks` (status=in_progress → tasksRunning), `missions` (status=failed, last 24h → errors24h)
- `getRecentSessions(limit)`: query `missions` ordered by `created_at desc`, limit
- `getRecentLogs(limit)`: query `war_room_events` ordered by `created_at desc`, limit
- `getTaskPipelineCounts`: query `tasks`, group by status, return counts per stage
- `getOutcomeCounts`: query proposals + missions grouped by domain → map to hunt/earn/guard/care/speak

**Acceptance:**
- **Given** queries.ts is updated
- **When** dashboard page imports these functions
- **Then** no TypeScript errors, functions return data from Supabase

**Files:**
- `lib/queries.ts` (modify — add 5 functions)
- `lib/types.ts` (modify — add types)

---

#### S1-T2: Local service probe library

**Model:** sonnet | **Parallel:** Group C

**JTBD:** When an API route needs to check service health, I want typed probe functions so each route doesn't reinvent health-checking.

**Outcome:**
`lib/local-services.ts` exporting probe functions. Each returns `ProbeResult`. On Vercel, all probes return `{ ok: false, detail: 'local-only', unavailable: true }`.

**Probes:**
- `probeSparkd()` — fetch `http://127.0.0.1:8787/status`, 3s timeout
- `probeBridgeWorker()` — read `~/.spark/bridge_worker_heartbeat.json`, check ts freshness < 5 min
- `probeLaunchServices()` — single `launchctl list` call, parse for PIDs. Cache 10s.
- `probeShogunatePoller()` — launchctl PID + Supabase heartbeat
- `probeOpenClaw()` — launchctl PID for openclaw process
- `probeSparkInsights()` — read `~/.spark/cognitive_insights.json`, return count
- `probeTabLedger()` — `sqlite3 ledger.db "SELECT count(*), printf('%.2f', sum(cost_usd)), max(started_at) FROM cc_sessions;"`
- `probeLosslessClaw()` — `sqlite3 lcm.db "SELECT count(*) FROM conversations; SELECT count(*) FROM messages;"`
- `probePipelineState()` — read `~/.spark/pipeline_state.json`
- `probeSystemFitness()` — read `~/.spark/system_fitness.json` (from S0-T3)

**Acceptance:**
- **Given** sparkd is running locally
- **When** `probeSparkd()` is called
- **Then** returns `{ ok: true, detail: 'healthy', meta: { totalInsights: N } }`

- **Given** running on Vercel
- **When** any probe is called
- **Then** returns `{ ok: false, detail: 'local-only', unavailable: true }`

**Error Handling:**
| Scenario | UX | Recovery |
|----------|-----|---------|
| sparkd unreachable | `{ ok: false, detail: 'unreachable' }` | 3s timeout, no retry |
| SQLite file missing | `{ ok: false, detail: 'file not found' }` | Graceful null |
| launchctl parse error | `{ ok: false, detail: 'parse error' }` | Return raw output in meta |
| JSON parse error | `{ ok: false, detail: 'invalid JSON' }` | Log + return false |

**Files:**
- `lib/local-services.ts` (create)

---

#### S1-T3: Services health API route

**Model:** sonnet | **Parallel:** Group D (depends on T2)

**JTBD:** When the dashboard loads, I want one API call returning all service statuses.

**API Contract:**
```
GET /api/services/health → {
  overall: "nominal" | "degraded" | "down" | "unavailable",
  checkedAt: ISO8601,
  isLocal: boolean,
  services: Record<string, ProbeResult>
}
```

**Acceptance:**
- **Given** all services running locally
- **When** `GET /api/services/health`
- **Then** returns `overall: "nominal"`, all services `ok: true`

**Files:**
- `app/api/services/health/route.ts` (create)

---

#### S1-T4: Memory status API route

**Model:** sonnet | **Parallel:** Group D (depends on T2)

**JTBD:** When the dashboard loads, I want one API call returning memory layer stats.

**API Contract:**
```
GET /api/memory/status → {
  checkedAt: ISO8601,
  isLocal: boolean,
  layers: {
    spark: { ok, insightCount, totalCreated, pipelineTrend },
    tab_ledger: { ok, sessionCount, totalCostUsd, lastIndexed },
    lossless_claw: { ok, conversationCount, messageCount, dbSizeMb },
    memory_md: { ok, lastModified, lineCount }
  },
  fitness: SystemFitness | null
}
```

**Files:**
- `app/api/memory/status/route.ts` (create)

---

#### S1-T5: Recent activity API route

**Model:** sonnet | **Parallel:** Group D (depends on T2)

**JTBD:** When I scroll the dashboard, I want a time-ordered activity feed showing what the system has been doing.

**API Contract:**
```
GET /api/activity/recent → {
  isLocal: boolean,
  items: ActivityItem[]  // merged from Spark, tab-ledger, poller, engine — top 20
}
```

**Implementation:**
- Spark: last 20 from `cognitive_insights.json`
- tab-ledger: last 5 sessions from SQLite
- Poller: last 10 events from Supabase `war_room_events`
- Merge all, sort by timestamp desc, return top 20

**Files:**
- `app/api/activity/recent/route.ts` (create)

---

### Sprint 2: Frontend — Outcomes Dashboard + System Health

**Demo:** Open `localhost:3000`. See five outcome cards (Hunt, Earn, Guard, Care, Speak) with real data from Supabase. Below them, a learnings feed showing system fitness. System Health is a collapsed accordion at the bottom. Fleet status shows agent count and attention-needed flags.

*This is the pivot from the architect's infrastructure-first layout to Sensei's outcome-first layout.*

---

#### S2-T1: Outcome cards (Hunt, Earn, Guard, Care, Speak)

**Model:** sonnet | **Parallel:** Group E

**JTBD:** When I open Tenshu, I want to see my five outcome categories at a glance — not infrastructure metrics — so I know what my agents accomplished and what needs attention.

**Outcome:**
Five outcome card components, one per category. Each shows:
- Category icon + name
- Headline metric (count or status phrase)
- 2-3 recent items with titles and timestamps
- Action button when items need review

**Visual spec:**
- Reuse `StealthCard` as container (existing, glass/frosted aesthetic)
- Headline in JetBrains Mono 20px
- Items in Space Grotesk 13px
- Color accent per category: Hunt (blue-500), Earn (green-500), Guard (amber-500), Care (purple-500), Speak (cyan-500)

**Data mapping (v1 — Supabase only):**
| Category | Query |
|----------|-------|
| Hunt | `proposals` where source in ('patrol', 'awareness') + `discoveries` — count + last 3 |
| Earn | `proposals` where domain = 'commerce' — count + last 3 |
| Guard | `missions` where domain in ('operations', 'engineering') + 24h error count |
| Care | Placeholder: "Connect Oura for health data" or morning brief excerpt |
| Speak | `war_room_events` where type in ('brief', 'notification') — last 3 |

**Acceptance:**
- **Given** 5 proposals exist with domain = 'commerce'
- **When** the Earn card renders
- **Then** shows "5 proposals" as headline, last 3 titles, and "Review" action button linking to `/proposals`

**Files:**
- `components/outcomes/hunt-card.tsx` (create)
- `components/outcomes/earn-card.tsx` (create)
- `components/outcomes/guard-card.tsx` (create)
- `components/outcomes/care-card.tsx` (create)
- `components/outcomes/speak-card.tsx` (create)

---

#### S2-T2: Learnings feed + fitness widget

**Model:** sonnet | **Parallel:** Group E

**JTBD:** When I want to know if the system is getting smarter, I want a learnings feed showing today's improvements and a fitness trend, so I see the self-improvement loop working.

**Outcome:**
A `LearningsFeed` component that shows:
- System fitness digest at top: "14 tasks, 3 corrections (down from 7), 2 skills improved" (from `system_fitness.json` via `/api/memory/status`)
- Miss rate trend arrow (improving/stable/degrading)
- Recent Spark insights promoted (last 5)
- Recent session autopsy summaries (last 3)

**Visual spec:**
- Fitness digest in a highlighted banner (green if improving, amber if stable, red if degrading)
- Insights as compact timeline items (purple dots, matches EventRail aesthetic)
- If no fitness data yet (Sprint 0 hasn't run): "Learning loop initializing — first metrics after 5 sessions"

**Acceptance:**
- **Given** `system_fitness.json` exists with `digest: "14 tasks, 3 corrections (down from 7), 2 skills improved"`
- **When** the learnings feed renders
- **Then** shows the digest text in a green banner with an up-arrow trend indicator

**Files:**
- `components/outcomes/learnings-feed.tsx` (create)

---

#### S2-T3: System health accordion + fleet status

**Model:** sonnet | **Parallel:** Group E

**JTBD:** When I need to check infrastructure, I want a collapsed accordion that expands to show service health, so it's available but not the primary view.

**Outcome:**
Two components:

1. `SystemHealthAccordion`: Collapsed by default. Shows one-line summary: "All systems nominal" (green) or "2 services need attention" (amber/red). Expands to show per-service rows with status dots, names, detail text. On Vercel: "Local services — run dev for details."

2. `FleetStatus`: Compact bar showing "3 agents active · 1 needs attention · 5 tasks running". Links to existing `/tasks` and `/agents` pages. Attention flag when any mission has status=failed in last hour.

**Visual spec:**
- Accordion header: single row, chevron icon, summary text
- Expanded: per-service rows matching existing `ServiceCard` pattern (glow dot + name + detail)
- Fleet status: horizontal bar with colored counts, similar to existing `StatCard` row but more compact

**Acceptance:**
- **Given** sparkd is down, all other services up
- **When** the accordion is collapsed
- **Then** shows "1 service needs attention" in amber
- **When** expanded
- **Then** shows sparkd with red dot, all others green

**Files:**
- `components/widgets/system-health-accordion.tsx` (create)
- `components/widgets/fleet-status.tsx` (create)

---

#### S2-T4: Dashboard page rebuild

**Model:** sonnet | **Parallel:** Group F (depends on E)

**JTBD:** When I open Tenshu, I want the home page to show outcomes first, learnings second, infrastructure last — so one screen tells me what matters.

**Outcome:**
Rewrite `app/dashboard/page.tsx` content area:

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│ [TopBar: Engine Live · Fleet: 3 active · Clock]       │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│  │  Hunt    │ │  Earn   │ │  Guard  │                │
│  │ 3 finds │ │ $4.2K   │ │ 0 bugs  │                │
│  └─────────┘ └─────────┘ └─────────┘                │
│  ┌─────────┐ ┌─────────┐                            │
│  │  Care   │ │  Speak  │                            │
│  │ Sleep 65│ │ Brief ✓ │                            │
│  └─────────┘ └─────────┘                            │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ Learnings: 14 tasks, 3 corrections (↓ from 7)│    │
│  │ • Spark: "drei SoftShadows compat" promoted   │    │
│  │ • Session: miss rate 8% (was 12%)             │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ▸ System Health: All nominal (click to expand)      │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [EventRail — existing realtime feed on right]       │
└──────────────────────────────────────────────────────┘
```

**Data flow:**
1. Page mounts → `Promise.all([fetch services/health, memory/status, activity/recent, getOutcomeCounts, getDashboardCounts, getRecentLogs])`
2. Set state, render outcome cards → learnings → system health accordion
3. `setInterval(30s)` auto-refresh
4. Keep: SidebarNav, top bar, EventRail (right rail)

**Existing code to preserve:**
- `SidebarNav` component
- Top bar (Engine Live, cycle time, gateway, ThemeToggle, clock)
- `EventRail` (right side rail with Supabase realtime subscription)
- `ConnectPrompt` (Supabase not configured fallback)

**Vercel fallback:** Outcome cards work normally (Supabase-backed). Learnings feed shows "Local metrics unavailable." System health accordion shows "Local services — run dev for details."

**Constraints:**
- Do NOT remove existing Supabase queries — outcome cards depend on them
- Keep SidebarNav and top bar exactly as-is
- Maintain dark theme compatibility

**Files:**
- `app/dashboard/page.tsx` (modify — heavy rewrite of content area)

---

### Sprint 3: Fitness, Validation, Tests

**Demo:** Weekly fitness digest email/brief includes "14 tasks, 3 corrections (down from 7), 2 skills improved." Probe library has tests. Build passes.

---

#### S3-T1: System fitness API route + validation gate stub

**Model:** sonnet | **Parallel:** Group G

**JTBD:** When the morning brief or dashboard needs the fitness metric, I want an API route that returns the computed fitness data, and a stub for the validation gate that will eventually decide patch promotion.

**Outcome:**
1. `GET /api/fitness/weekly` — reads `~/.spark/system_fitness.json`, returns `SystemFitness` type. On Vercel: returns null with `isLocal: false`.

2. `lib/fitness-metric.ts` — helper that:
   - Reads session autopsies from `~/.spark/session_autopsies/`
   - Computes 7-day rolling metrics (same logic as `compute-fitness.sh` but in TypeScript for API use)
   - Includes validation gate stub: `validatePatch(patch) → { approved: boolean, reason: string, replayResults: [] }` — always returns `approved: false, reason: 'validation gate not yet implemented'` in v1

**Acceptance:**
- **Given** 5 session autopsies exist
- **When** `GET /api/fitness/weekly` is called
- **Then** returns a valid `SystemFitness` object with computed miss rate and trend

**Files:**
- `app/api/fitness/weekly/route.ts` (create)
- `lib/fitness-metric.ts` (create)

---

#### S3-T2: Unit tests for probe library

**Model:** sonnet | **Parallel:** Group G

**JTBD:** When someone modifies the probe functions, I want automated tests that verify correct parsing and error handling.

**Tests:** `tests/unit/local-services.test.ts`
- Mock `fetch` for sparkd
- Mock `execFile` for launchctl + sqlite3
- Mock `fs.readFile` for JSON files
- Test Vercel guard (`process.env.VERCEL = '1'`)
- Test timeout / malformed output handling

**Acceptance:**
- **Given** tests are written
- **When** `npx vitest run tests/unit/local-services.test.ts`
- **Then** all pass

**Files:**
- `tests/unit/local-services.test.ts` (create)

---

#### S3-T3: Build verification

**Model:** sonnet | **Parallel:** Group G

**Outcome:**
- `npm run build` exits 0
- No type errors or missing imports
- Verify EventRail still receives realtime events
- Verify Vercel preview shows graceful fallbacks
- Verify outcome cards render with Supabase data

**Files:** None (verification only)

---

## Execution Table

| Group | Tasks | Model | Parallel? | Notes |
|-------|-------|-------|-----------|-------|
| A | S0-T1, S0-T2 | sonnet | Yes | Intent hooks + session autopsy (both shell scripts, independent) |
| B | S0-T3 | sonnet | No | Fitness baseline (depends on A for data format) |
| C | S1-T1, S1-T2 | sonnet | Yes | Types/queries + probe library (independent) |
| D | S1-T3, S1-T4, S1-T5 | sonnet | Yes | API routes (depend on C for imports) |
| E | S2-T1, S2-T2, S2-T3 | sonnet | Yes | All components (independent of each other) |
| F | S2-T4 | sonnet | No | Dashboard page (depends on C + D + E) |
| G | S3-T1, S3-T2, S3-T3 | sonnet | Yes | Fitness API + tests + build verify |

**Swarm verdict:** hybrid — A parallel, B sequential gate, C parallel, D parallel (after C), E parallel, F sequential gate, G parallel.

---

## Rollout

- **Feature branch:** `feature/operations-hub` (exists, no commits yet)
- **No feature flag** — replaces dashboard content
- **Vercel preview:** Auto via PR. Outcome cards work (Supabase-backed). Local-only widgets show graceful fallback.
- **Sprint 0 deploys to `~/.claude/hooks/`** — not the war-room repo. No Vercel impact.
- **Kill switch:** `git revert` the dashboard page change

## Rollback

| Sprint | Rollback |
|--------|----------|
| S0 | Delete hook scripts from `~/.claude/hooks/`. Delete `~/.spark/intent_deltas.jsonl`, `session_autopsies/`, `candidate_patches/`. No app impact. |
| S1 | Delete API routes + `lib/local-services.ts`. Revert queries.ts and types.ts additions. No DB changes. |
| S2 | Revert `dashboard/page.tsx`. Delete `components/outcomes/` + `components/widgets/system-health-accordion.tsx` + `components/widgets/fleet-status.tsx`. |
| S3 | Delete test files + `lib/fitness-metric.ts` + fitness API route. No runtime impact. |

**Full rollback:** `git revert <merge-commit>` — everything is additive files + one page modification.

---

## Out of Scope (with triggers to revisit)

| Item | Trigger to revisit |
|------|-------------------|
| **Drag-and-drop widget reordering** | When 3+ users request layout preferences |
| **Terminal emulation (xterm.js/node-pty)** | When local companion server is validated — requires server-side PTY, incompatible with Vercel |
| **SVG sparklines with historical data** | After 2 weeks of fitness data accumulated |
| **Toji Red Team agent** | After validation gate is working (council matrix #5) — needs the measurement loop first |
| **External Knowledge Ingestion** | After validation gate proves patches can be safely promoted (council matrix #6) |
| **Auto-business discovery** | After Earn pipeline has invoice/proposal generation working |
| **Push notifications / DMG companion** | After outcome categories prove useful on web — don't build native until web validates |
| **Oura API integration** | When Care card placeholder gets clicked 3+ times (proves demand) |
| **Twitter/arxiv automated ingestion** | When Hunt card has manual workflow validated |
| **Revenue loop (invoices, Stripe)** | Separate spec — Jack CRM TRD exists at `.specs/2026-02-27-jack-crm-TRD.md` |
| **Drift Engine** (adaptive behavior tuning) | After fitness metric has 30+ days of data showing trends |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Intent journaling adds latency to every tool use | High | Hooks MUST return <100ms. No LLM calls. Pure file append. Benchmark on first run. |
| Session autopsy misclassifies deltas (false misses) | Medium | Conservative delta: default to "partial" when uncertain. Review first 10 autopsies manually. |
| Outcome cards show empty data (no proposals in earn/hunt domains) | Medium | Show helpful placeholder: "No [category] activity yet — here's how to start." Link to relevant action. |
| `better-sqlite3` native addon breaks Vercel build | High | Don't use it. Shell out to `sqlite3` CLI via `execFile`. |
| `launchctl list` output format changes | Low | Parse PID column only. Stable since macOS 10.6. |
| Three learning systems (Spark, tab-ledger, OpenSpace) produce contradictory signals | Medium | Fitness metric is the single source of truth. It reads from all three but produces one number. |
| Dashboard page rewrite breaks existing EventRail realtime | Medium | EventRail is a separate component. Keep its Supabase subscription untouched. Test explicitly in S3-T3. |

---

## Open Questions

- [ ] Should Sprint 0 hooks live in the war-room repo or in `~/.claude/hooks/` (global)? Current plan: global hooks, since they serve all projects.
- [ ] Should fitness metric feed into the morning brief immediately, or wait for dashboard validation? Current plan: dashboard first, morning brief in follow-up.
- [ ] What's the minimum number of sessions before fitness metric is meaningful? Proposed: 5 sessions (show "insufficient data" before that).

---

## Success Criteria

1. **Learning loop is measurably closed** — after 10 sessions, `system_fitness.json` exists with non-zero data and at least 1 candidate patch generated
2. **Dashboard shows outcomes, not infrastructure** — the five outcome cards are the primary view, system health is collapsed by default
3. **Infrastructure health is still accessible** — expanding the accordion shows real probe data for all local services
4. **Build passes on Vercel** — `npm run build` exits 0, preview deploys show graceful fallbacks for local-only data
5. **Morning brief can reference fitness** — the `system_fitness.json` format is compatible with the existing brief generator
6. **Zero broken imports** — the `getDashboardCounts`, `getRecentSessions`, `getRecentLogs` functions exist and return data

---

## Verification

**Build:** `npm run build` passes
**Unit tests:** `npx vitest run tests/unit/local-services.test.ts`
**Hook verification:**
1. Run a short Claude Code session with intent hooks registered
2. Check `~/.spark/intent_deltas.jsonl` has entries
3. End session, check `~/.spark/session_autopsies/` has a summary
4. Run `compute-fitness.sh`, check `~/.spark/system_fitness.json`

**Dashboard smoke test:**
1. `npm run dev` → open `localhost:3000`
2. Five outcome cards visible with data from Supabase (or helpful placeholders)
3. Learnings feed shows fitness digest (or "initializing" message)
4. System Health accordion is collapsed, shows summary
5. Expand accordion → per-service status with green/red dots
6. EventRail (right rail) still receives realtime events
7. Wait 30s → verify auto-refresh
8. Push to Vercel → verify outcome cards work, local-only widgets show graceful fallback
