# Agent Awareness Loop — Implementation Plan

**Goal:** Make Daimyo agents proactive instead of reactive. Agents monitor the event stream and independently propose actions based on their domain expertise.

**Architecture:** New `engine/awareness.py` module scans recent events every 6th poll cycle (~60s). Each event is routed to domain-relevant agents via `DOMAIN_TO_DAIMYO` dict lookup. One batched Haiku call per agent (not per-event) determines if the agent has a useful proposal. If yes, `create_proposal()` is called with `source: 'awareness'`. Rate-limited to prevent spam. 5-second subprocess timeout prevents blocking the poller. Max 10-minute lookback window on restart.

**Council Amendments Applied:**
1. Batch Haiku calls — one call per agent with summarized events, not per-event
2. Awareness cadence — every 6th poll cycle (~60s), not every cycle
3. Lookback cap — max 10-minute event window regardless of gap + 5s subprocess timeout

**Tech Stack:** Python (shogunate engine), Supabase (events + proposals tables), Claude Haiku (evaluation), War Room frontend (awareness indicator on dashboard)

---

## Experience Outcome

When I wake up, the dashboard shows proposals that agents created overnight by watching the event stream — not because I asked, but because they noticed something worth acting on. Ed sees a mission fail and proposes a retry with a different approach. Nanami sees costs rising and flags it. Major notices patrol findings and proposes an ops response. The system feels alive.

## Context

Currently agents only act when given explicit proposals (manual, cron trigger, or reflexive evaluator for stalled objectives). The event stream (`war_room_events`) has 20+ event types flowing through it, but nobody's watching. The awareness loop closes this gap — agents become sensors, not just actuators.

## File Inventory

| File | Lines | Action |
|------|-------|--------|
| `engine/awareness.py` | ~180 | create |
| `engine/poller.py:121-261` | 140 | modify (add step 0.25) |
| `engine/config.py` | 100 | modify (add awareness config) |
| `engine/notifications.py:1-50` | 50 | read-only (EVENT_SEVERITY reference) |
| `tests/unit/test_awareness.py` | ~120 | create |
| `app/api/dashboard/route.ts` | ~80 | modify (add awareness stats) |
| `components/status-ribbon.tsx` | 262 | modify (add awareness indicator) |

## Dependencies

- No new packages — uses existing `subprocess` + `create_proposal()` + `emit()`
- Haiku model already configured as `CHEAP_MODEL`

## Assumptions

- Event volume is low enough that scanning last-N events per cycle is fine (no streaming needed)
- Haiku can determine relevance in <2s per event-agent pair
- Rate limiting by agent+hour prevents proposal spam
- Existing `auto_approve_eligible()` and council review handle proposal quality

---

## Sprint 1: Core Awareness Engine (Shogunate)

### S1-T1: awareness.py — Domain Router + Event Scanner

**Model:** sonnet | **Parallel:** Group A

**JTBD:** When the poller runs a cycle, I want domain-relevant events routed to the right agents so that agents can evaluate whether to propose action.

**Outcome:**
New `engine/awareness.py` with three functions:
1. `get_recent_events(since_iso: str) -> list[dict]` — fetch events from `war_room_events` since timestamp
2. `route_events_to_agents(events: list[dict]) -> dict[str, list[dict]]` — map events to relevant daimyo IDs via `DOMAIN_TO_DAIMYO` dict lookup (not keyword matching)
3. `run_awareness_cycle(state: dict) -> list[dict]` — orchestrator: get events, route, batch-evaluate per agent, create proposals

**Domain routing rules:**
- `mission_failed`, `mission_completed`, `agent_action` → agent's own domain + `ed` (engineering)
- `patrol_complete`, `health_check_failed` → `major` (operations)
- `discovery_approved` → domain of the discovery's category
- `proposal_rejected` → original domain agent
- `objective_stalled`, `objective_capped` → `light` (strategy) + domain agent
- `skill_patch_extracted`, `cross_pollination` → `ed` (engineering)
- `heartbeat`, `trigger_fired`, `trigger_created` → skip (noise)

**Interface:**
```python
def get_recent_events(since_iso: str) -> list[dict]:
    """Fetch war_room_events since timestamp, max 50."""

def route_events_to_agents(events: list[dict]) -> dict[str, list[dict]]:
    """Map events to daimyo IDs. Returns {daimyo_id: [events]}."""

def evaluate_agent_awareness(
    daimyo_id: str,
    events: list[dict],
    rate_limit_key: str,
) -> dict | None:
    """ONE batched Haiku call per agent with all their events summarized.
    5-second subprocess timeout. Returns proposal dict or None."""

def run_awareness_cycle(state: dict) -> list[dict]:
    """Full cycle. Returns list of created proposals."""
```

**Rate limiting:** Track `{daimyo_id}:{hour}` in state dict. Max 2 proposals per agent per hour.

**Acceptance:**
- **Given** 3 events in war_room_events (mission_failed, patrol_complete, discovery_approved)
- **When** `run_awareness_cycle()` is called
- **Then** events are routed to correct agents; Haiku evaluates; proposals created for actionable items

**Tests:** `tests/unit/test_awareness.py` — mock supabase + subprocess, test routing logic, rate limiting
**Error Handling:** | Scenario | UX | Recovery |
| Haiku timeout | Log warning | Skip event, continue |
| Supabase down | Log error | Return empty, next cycle retries |
| Rate limit hit | Log info | Skip agent for this hour |

**Files:**
- `engine/awareness.py` (create — ~180 lines)
- `tests/unit/test_awareness.py` (create — ~120 lines)


### S1-T2: Poller Integration — Step 0.25

**Model:** sonnet | **Parallel:** Group A

**JTBD:** When the poller runs, I want awareness checks to happen automatically so that agents stay informed without manual intervention.

**Outcome:**
Add step 0.25 to `poll_cycle()` between triggers (step 0) and patrol (step 0.5). Awareness runs every 6th cycle (~60s) gated by `AWARENESS_ENABLED` config flag AND cycle count modulo. Updates `state["last_awareness_scan"]` timestamp for event windowing. Lookback window capped at 10 minutes regardless of gap.

**Interface:**
```python
# In poll_cycle(), after step 0 (triggers):
# 0.25. Agent awareness scan (every 6th cycle = ~60s)
awareness_cadence = getattr(config, 'AWARENESS_CADENCE_CYCLES', 6)
if config.AWARENESS_ENABLED and state.get("cycle_count", 0) % awareness_cadence == 0:
    try:
        from engine.awareness import run_awareness_cycle
        awareness_proposals = run_awareness_cycle(state)
        if awareness_proposals:
            log.info(f"Awareness: {len(awareness_proposals)} proposal(s) created")
    except Exception as e:
        log.error(f"awareness scan error: {e}")
```

**Acceptance:**
- **Given** `AWARENESS_ENABLED=true` in config and cycle_count is divisible by 6
- **When** `poll_cycle()` runs
- **Then** awareness scan executes between triggers and patrol, state updated
- **Given** cycle_count is NOT divisible by 6
- **When** `poll_cycle()` runs
- **Then** awareness scan is skipped

**Files:**
- `engine/poller.py` (modify — add ~15 lines after line 136)
- `engine/config.py` (modify — add `AWARENESS_ENABLED`, `AWARENESS_MAX_EVENTS`, `AWARENESS_PROPOSALS_PER_AGENT_PER_HOUR`, `AWARENESS_CADENCE_CYCLES`, `AWARENESS_MAX_LOOKBACK_MINUTES`, `AWARENESS_TIMEOUT_SECONDS`)


### S1-T3: Awareness Event Emission

**Model:** sonnet | **Parallel:** Group A

**JTBD:** When awareness creates a proposal, I want an event emitted so the war room dashboard can show awareness activity.

**Outcome:**
In `run_awareness_cycle()`, emit `awareness_proposal_created` event for each proposal. Also emit `awareness_cycle_complete` with summary stats. Add these to `EVENT_SEVERITY` in notifications.py (`awareness_proposal_created` = `info`, `awareness_cycle_complete` = `silent`).

**Acceptance:**
- **Given** awareness creates 2 proposals
- **When** cycle completes
- **Then** 2 `awareness_proposal_created` + 1 `awareness_cycle_complete` events emitted

**Files:**
- `engine/awareness.py` (already being created in S1-T1 — emit calls included)
- `engine/notifications.py` (modify — add 2 event types to EVENT_SEVERITY dict)


## Sprint 2: War Room Frontend Integration

### S2-T1: Dashboard Awareness Indicator

**Model:** sonnet | **Parallel:** Group B

**JTBD:** When I open the dashboard, I want to see how many awareness-sourced proposals exist so I know agents are thinking proactively.

**Outcome:**
Add awareness stats to the dashboard API and a small indicator on the StatusRibbon. Query proposals where `source = 'awareness'` and `status = 'pending'`. Show count badge on the SituationCard.

**API addition** (in dashboard route):
```typescript
const { count: awarenessCount } = await sb
  .from('proposals')
  .select('*', { count: 'exact', head: true })
  .eq('source', 'awareness')
  .eq('status', 'pending')
```

**UI:** Add a small "AI" badge next to the pending count in SituationCard when `awarenessCount > 0`.

**Acceptance:**
- **Given** 3 pending proposals with `source = 'awareness'`
- **When** dashboard loads
- **Then** SituationCard shows awareness count badge

**Files:**
- `app/api/dashboard/route.ts` (modify — add awareness query)
- `components/status-ribbon.tsx` (modify — add awareness badge to SituationCard)

---

## Execution Table

| Group | Tasks | Parallel? |
|-------|-------|-----------|
| A | S1-T1, S1-T2, S1-T3 | Yes (independent files) |
| B | S2-T1 | After Group A |

**Verdict:** Hybrid — Group A parallel, Group B sequential after.

## Rollback

- **Sprint 1:** `AWARENESS_ENABLED=false` in config disables entirely. Delete `engine/awareness.py`, revert poller.py.
- **Sprint 2:** Revert dashboard route + status-ribbon changes.

## Out of Scope (Deferred)

- Agent memory of past awareness evaluations (defer until awareness proves valuable)
- Awareness of cross-agent interactions (defer until multi-domain routing needed)
- Custom awareness rules per agent (defer — domain routing is sufficient v1)
- Full awareness history page in war room (defer — proposals page already shows them via source filter)

## Verification

```bash
# Shogunate
cd ~/Code/shogunate && python -m pytest tests/unit/test_awareness.py -v

# War Room
cd ~/Code/war-room && npm run build
```
