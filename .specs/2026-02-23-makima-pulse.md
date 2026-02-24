# Makima's Pulse — Engine Awareness for Shoin Chat

**Date:** 2026-02-23
**Branch:** feature/makima-pulse off feature/dashboard-enhancements

## Experience Outcome

When I chat with Makima, she knows what's happening. She references active missions, flags stale tasks, knows my project priorities. When I say "create a mission for the Folio auth fix", she responds with a structured action and the system creates it.

## Sprint 1: Pulse Context Injection
- [x] P1-T1: Build pulse context assembler (`lib/pulse-context.ts`)
- [x] P1-T2: Inject pulse into chat route (`app/api/chat/route.ts`)
- [x] P1-T3: Pulse status indicator in chat UI (`app/chat/page.tsx`)

## Sprint 2: Action Routing
- [x] P2-T1: Action parser (`lib/pulse-actions.ts`)
- [x] P2-T2: Wire action execution into chat route
- [x] P2-T3: Action instruction in system prompt

## Sprint 3: Proactive Alerts
- [ ] P3-T1: Pulse alert generator (`lib/pulse-alerts.ts`)
- [ ] P3-T2: Auto-inject alerts on thread open

## Rollback
All changes additive (new files) or guarded by `isMakima` checks. Rollback = revert commit. No DB changes.
