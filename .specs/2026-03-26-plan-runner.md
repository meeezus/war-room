# Plan Runner — Drop a Plan, Watch It Execute

## Context

Sensei builds across 6+ repos. Current workflow: paste plan into N Ghostty sessions manually. Plan Runner turns Tenshu from a dashboard into an **execution engine** — drop a markdown plan, review outcomes, click execute, watch live progress.

**Key insight:** The Shogunate engine already picks up queued missions/tasks from Supabase. We don't touch Python. We create the right rows from TypeScript, and the existing poller executes them.

**Existing infrastructure reused:**
- `POST /api/missions/from-plan` — creates missions + tasks (template)
- Proposal → mission → task → execute pipeline (Shogunate)
- EventRail + realtime hooks (live progress)
- Flywheel scoring rubric (auto-run gating)

---

## Data Model

**New table: `plans`**
```sql
plans (id, title, raw_markdown, parsed_beads JSONB, status, flywheel_score, score_breakdown JSONB, auto_run, wave_count, created_at, updated_at)
```
Status: draft → reviewing → approved → running → completed | failed

**Existing table modifications:**
- `missions` — add `plan_id UUID REFERENCES plans(id)` + `wave_index INT`
- `tasks` — add `working_dir TEXT` (for multi-repo routing)

No new bead table. One bead = one mission with tasks. Reuses 100% of the execution pipeline.

---

## Beads

### BEAD-001: Plans table migration + types
- **Depends on:** none
- **Blocks:** 002, 003, 004, 005
- **Size:** S
- **Accept:** Migration applied. Plan + ParsedBead types in lib/types.ts. `npm run build` passes.
- **Files:** `supabase/migrations/YYYYMMDD_plans.sql`, `lib/types.ts`

### BEAD-002: Plan parser library
- **Depends on:** 001
- **Blocks:** 003
- **Size:** M
- **Accept:** `parsePlanMarkdown(md)` extracts beads with dependencies, computes waves via topological sort, computes flywheel score. Unit tests pass.
- **Files:** `lib/plan-parser.ts`, `lib/__tests__/plan-parser.test.ts`

Parses: `## BEAD-xxx: Title` headers, `Depends on:`, `Blocks:`, `Size:`, `Accept:`, `Files:`, `Repo:`, `Domain:`, `Money:`, `Blast Radius:`, `Novelty:`. Topological sort assigns wave_index.

### BEAD-003: Plan API routes (CRUD + ingest + analysis)
- **Depends on:** 001, 002
- **Blocks:** 005, 006
- **Size:** L
- **Accept:** POST /api/plans/ingest accepts markdown, parses beads, scores flywheel, THEN triggers analysis based on score. GET /api/plans lists plans. GET/PATCH /api/plans/[id] for detail + edit. POST /api/plans/[id]/analyze triggers deeper analysis.
- **Files:** `app/api/plans/ingest/route.ts`, `app/api/plans/route.ts`, `app/api/plans/[id]/route.ts`, `app/api/plans/[id]/analyze/route.ts`, `lib/plan-analyzer.ts`, `lib/queries.ts` (add getPlan, getPlans, getPlanMissions)

**Ingestion flow (adaptive — detects structure level):**

0. Parse markdown → check for `BEAD-xxx` headers:
   - **Structured** (has beads): skip brainstorm → go to step 1
   - **Rough idea** (paragraphs, no beads): auto-trigger brainstorm agent (Sonnet) to clarify intent, extract requirements, identify repos, propose beads with dependencies. Agent writes enhanced plan back. Status: `brainstorming` → step 1.
   - **One-liner** (< 200 chars): brainstorm mandatory. Agent expands into requirements + proposes beads.
1. Parse markdown → beads + waves + flywheel score
2. Store as `status: 'analyzing'`
3. Based on score, trigger flywheel analysis:
   - Score 3-4: skip analysis → `status: 'reviewing'` immediately
   - Score 5-6: spawn Sonnet agent to sanity-check the plan (quick review, ~30s)
   - Score 7-8: spawn Opus agent to run multi-perspective analysis (blind spots, alternatives, ~2min)
   - Score 9: spawn full council matrix (2 models × 3 councils, ~5min)
4. Agent writes analysis results to `plans.analysis` JSONB column:
   ```json
   {
     "depth": "polyclaude",
     "pushback": ["Jack contradicts himself — lookup table may serve stale answers"],
     "alternatives": ["Use RAG with recency weighting instead of static lookup"],
     "blind_spots": ["No fallback for questions outside supplement domain"],
     "recommendation": "Proceed with modifications — add recency layer"
   }
   ```
5. Update `status: 'reviewing'` — plan ready for Sensei to review with analysis attached
6. UI shows analysis card with pushback, alternatives, blind spots before the "Approve" button

### BEAD-004: Plan approval + execution bridge
- **Depends on:** 001, 003
- **Blocks:** 007
- **Size:** M
- **Accept:** POST /api/plans/[id]/approve transitions plan to running, creates wave 0 missions + tasks in Supabase with plan_id. Poller picks them up and executes.
- **Files:** `app/api/plans/[id]/approve/route.ts`

Creates missions per bead with `plan_id`, `wave_index`. Wave 0 gets status='queued', later waves are inserted only when preceding wave completes.

### BEAD-005: Wave advancement cron
- **Depends on:** 004
- **Blocks:** 007
- **Size:** S
- **Accept:** Every 30s, checks running plans. If current wave's missions all terminal, inserts next wave's missions as queued. If all waves done, marks plan completed/failed. Emits plan events.
- **Files:** `app/api/cron/plan-waves/route.ts`

### BEAD-006: Plans list + detail pages
- **Depends on:** 003
- **Blocks:** 007
- **Size:** L
- **Accept:** /plans page shows plan list with status badges. /plans/[id] shows outcome summary, wave graph, flywheel score, auto-run toggle, "Approve & Execute" button.
- **Files:** `app/plans/page.tsx`, `app/plans/[id]/page.tsx`, `components/plan-wave-graph.tsx`, `components/sidebar-nav.tsx` (add Plans link)

Wave graph: horizontal swim-lane diagram. Beads in columns by wave, dependency lines between them. Status colors animate in real-time.

### BEAD-007: Live progress + realtime
- **Depends on:** 004, 005, 006
- **Blocks:** none (terminal)
- **Size:** M
- **Accept:** Plan detail page shows live bead status via realtime subscriptions. EventRail filters to plan-specific events. Completion banner shows per-bead pass/fail + total time.
- **Files:** `lib/realtime.ts` (add useRealtimePlanMissions), `app/plans/[id]/page.tsx` (enhance with realtime)

---

## Dependency Graph

```
BEAD-001 ──→ BEAD-002 ──→ BEAD-003 ──→ BEAD-004 ──→ BEAD-005 ──→ BEAD-007
                              └──→ BEAD-006 ──────────────────────→ BEAD-007
```

## Execution Waves

| Wave | Beads | Parallel? |
|------|-------|-----------|
| 0 | BEAD-001 (migration + types) | Solo |
| 1 | BEAD-002 (parser) | Solo |
| 2 | BEAD-003, BEAD-006* | BEAD-003 first (006 needs its queries) |
| 3 | BEAD-004, BEAD-005, BEAD-006 | Yes — 3 parallel |
| 4 | BEAD-007 (realtime integration) | Solo |

*BEAD-006 pages can start in wave 2 (layout/UI), wire data in wave 3 after APIs exist.

---

## Verification

1. `npm run build` passes
2. Drop the JackBot brain handoff into /api/plans/ingest → get parsed beads back
3. /plans page shows the plan with flywheel score
4. Click "Approve & Execute" → missions appear in Supabase
5. Poller picks up tasks and executes
6. Plan detail page shows live bead status updates
7. Wave advancement works (wave 1 starts after wave 0 completes)
8. Plan marked completed when all beads done

---

### BEAD-008: Obsidian vault sync
- **Depends on:** 003
- **Blocks:** none
- **Size:** S
- **Accept:** When a plan is ingested, a markdown copy is saved to `~/Shugyo/plans/{repo}/{date}-{slug}.md`. Folders are auto-created per repo. Cross-repo plans go to `~/Shugyo/plans/cross-repo/`.
- **Files:** `lib/vault-sync.ts`, called from plan ingest API route

**Vault organization:**
```
~/Shugyo/plans/
  war-room/          # war-room specific plans
  shogunate/         # engine plans
  folio-app/         # folio plans
  skool-scraper/     # client project plans
  cross-repo/        # plans spanning multiple repos
  {date}-{slug}.md   # each plan file
```

Plan file includes: title, flywheel score, wave breakdown, bead list, status (updated on completion). Obsidian can cross-link these via wikilinks.

---

## Updated Dependency Graph

```
BEAD-001 ──→ BEAD-002 ──→ BEAD-003 ──→ BEAD-004 ──→ BEAD-005 ──→ BEAD-007
                              ├──→ BEAD-006 ──────────────────────→ BEAD-007
                              └──→ BEAD-008 (vault sync)
```

## Updated Execution Waves

| Wave | Beads | Parallel? |
|------|-------|-----------|
| 0 | BEAD-001 (migration + types) | Solo |
| 1 | BEAD-002 (parser) | Solo |
| 2 | BEAD-003 (API routes) | Solo |
| 3 | BEAD-004, BEAD-005, BEAD-006, BEAD-008 | Yes — 4 parallel |
| 4 | BEAD-007 (realtime integration) | Solo |

---

## What We Don't Build (Yet)

- Multi-repo `cwd` in executor.py — encode working dir in task description for now
- Magical UX (animations, sounds, haptics) — functional first, polish later
- iMessage/Discord notifications on completion — wire through existing Makima channels later
- Vault auto-cleanup/organization agent — separate Shogunate skill
