# War Room: Morning Handoff Continuation

## Context

Resuming from `2026-02-25_09-16_morning-fixes-merge.yaml`. Nine items remain from the handoff's `next:` list spanning ops, frontend polish, chat fixes, and engine upgrades.

## Experience Outcome

When I open War Room on my phone, the layout is usable. Awareness proposals show which agent noticed what. Chat streaming is reliable. The skill evolution pipeline actually runs and writes patterns to SKILL files.

## Sprints

### Sprint 0: Ops Housekeeping

- S0-T1: Merge shogunate feature/makima-coo → main
- S0-T2: Restart poller on main
- S0-T3: Close stale PRs (#12, #5)

### Sprint 1: Frontend Polish

- S1-T1: Mobile responsive quick pass (md: breakpoints, sidebar drawer, single-column stacking)
- S1-T2: Awareness proposals UX — agent avatar + "noticed this" purple label
- S1-T3: Seed objectives data (3-5 real objectives)

### Sprint 2: Chat Fixes

- S2-T1: SSE fragmentation fix (buffer accumulation before flush)
- S2-T2: Makima action delay (first token latency)

### Sprint 3: Skill Evolution Upgrade

- S3-T1: Wire skill evolution into poller cycle
- S3-T2: Fix skill patches query bug (applied boolean, not status enum)
- S3-T3: Layer 2 — Reasoning frameworks in SKILL files
- S3-T4: Layer 3 — Post-mission verification gate

## Execution

| Group | Tasks | Dependencies |
|-------|-------|-------------|
| 1 | S0-T1→S0-T2, S0-T3 | None |
| 2 | S1-T1, S1-T2, S1-T3, S2-T1, S2-T2 | None |
| 3 | S3-T1, S3-T2, S3-T3, S3-T4 | S0-T1 |

## Status — ALL COMPLETE

- [x] S0-T1: Merge shogunate (13 commits, fast-forward)
- [x] S0-T2: Restart poller (PID reloaded on main)
- [x] S0-T3: Close stale PRs (#5 closed, #12 already merged)
- [x] S1-T1: Mobile responsive (6 files — drawers, stacking, overflow-x-hidden)
- [x] S1-T2: Awareness proposals UX (purple "noticed this" + agent avatar initials)
- [x] S1-T3: Seed objectives (5 objectives, idempotent migration)
- [x] S2-T1: SSE fragmentation fix (rAF batching, max 60 setState/sec)
- [x] S2-T2: Makima action delay (pulse context moved inside stream, typing event first)
- [x] S3-T1: Wire skill evolution into poller (step 4.25, verification + application)
- [x] S3-T2: Fix skill patches query (already fixed from prior session)
- [x] S3-T3: Layer 2 reasoning frameworks (when/why/confidence in SKILL entries)
- [x] S3-T4: Layer 3 verification gate (+0.05 followed, -0.1 violated, runs before apply)

## Additional

- Added migration `20260226000004_skill_patches_reasoning.sql` for when_applies/why_matters columns
- Noted: poller has `proposals_source_check` constraint missing 'reflexive' value (not in scope)
