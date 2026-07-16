# KAIROS Follow-ups — Reconstructed Handoff

**Date:** 2026-07-16
**Author:** reconstructed by Claude (the three original 2026-04-01 handoff files were never created/committed)
**Why this exists:** A scheduled routine kept pinging to check three KAIROS follow-up
handoffs (`2026-04-01_session{1,2,3}_*.md`). Those files never existed in the repo —
only planned. This file captures what each session actually *was*, reconstructed from
the codebase, so the work can be resumed from a terminal later. Kill the scheduled
routine (see bottom) so the pings stop.

---

## Session 1 — Council Consolidation

**What it is:** Cleaning up the Council feature's data model. Council is a real, live
feature (`app/council/[id]/`, `app/api/council/`, `app/api/chat/council/`,
`components/council/*`).

**The core problem (from CLAUDE.md Spark learning + commit `7c895a7`):**
> `CouncilReview` data in the database uses **inconsistent field names** across sessions.

Commit `7c895a7` ("council session crash") was a band-aid: it *normalized 5 field-name
variants at read time* and added a `resolved` status migration
(`20260226300000_council_status_resolved.sql`). Consolidation is the real fix.

**Scope to resume:**
- Define one canonical council-session schema; stop normalizing 5 variants at read time.
- Write a migration that rewrites existing rows to the canonical field names.
- Fold in the now-deleted `/proposals` concept (killed in `7c895a7`) if council is meant
  to subsume it — check `app/api/proposals/route.ts` (still present) vs. the removed page.
- Remove the read-time normalization shim once data is clean.

**Key files:** `lib/types.ts`, `app/api/council/[id]/route.ts`,
`app/api/migrate-council/route.ts`, `components/council/council-card.tsx`,
`.specs/2026-02-23-dashboard-crud-council-flow.md` (Sprint 2 = Council Flow).

---

## Session 2 — Jōzai Daemon Plan

**What it is:** A *plan* (never built) for a "Jōzai" (常在 — "ever-present / always
resident") daemon. No `jozai` code exists in the repo — this was design-only.

**Context:** The existing background engine is the **Shogunate poller** —
`engine/poller.py`, a 10s polling daemon auto-started via `com.warroom.poller.plist`
(see `docs/shogunate-engine-manual.md` §4 "The Poller"). Jōzai was the next step: an
always-resident daemon rather than a 10s poll-and-exit cycle — likely for continuous
agent awareness and to trigger autoresearch (Session 3) rather than waiting on polls.

**Scope to resume:**
- Decide: does Jōzai replace `poller.py`, or run alongside it?
- Write the actual design doc (this session was supposed to produce a plan, not code).
- Reference the existing daemon-thread pattern noted in
  `thoughts/shared/handoffs/war-room/2026-02-26_23-12_evaluator-feedback-loop.yaml`
  (`daemon_thread_for_failure_eval` — best-effort, never blocks the poll cycle).

**Key files:** `engine/poller.py`, `tests/unit/test_poller.py`,
`docs/shogunate-engine-manual.md`.

---

## Session 3 — Autoresearch + Extras

**What it is:** An automated research pipeline. `autoresearch` is already a first-class
*source* in the research UI (`app/research/page.tsx`: `SOURCES = ['all','twitter',
'arxiv','autoresearch','brave','perplexity','manual']`), and `ResearchFinding` /
`components/outcomes/research-card.tsx` exist to display findings.

**Scope to resume:**
- Build/finish the pipeline that populates `autoresearch`-sourced `ResearchFinding` rows
  (the UI tab exists; confirm whether anything writes to it).
- "Extras" = grab-bag of smaller follow-ups from that session (specifics were never
  written down — treat as: tidy loose ends surfaced while doing the above).

**Key files:** `app/research/page.tsx`, `components/outcomes/research-card.tsx`,
`lib/types.ts` (`ResearchFinding`).

---

## Resume commands

```
/resume_handoff thoughts/shared/handoffs/general/2026-07-16_kairos-followups-reconstructed.md
```

(The original per-session commands below refer to files that do not exist — kept only
so the old routine's reminder text maps to something:)
- Session 1: council-consolidation — see above
- Session 2: jozai-daemon-plan — see above
- Session 3: autoresearch-and-extras — see above

## Kill the reminder
The recurring "check 3 KAIROS handoffs" run is a **scheduled routine on the Claude Code
web platform** (not an in-session cron job). Delete/disable it in the web UI to stop the
pings. Nothing in this repo drives it.
