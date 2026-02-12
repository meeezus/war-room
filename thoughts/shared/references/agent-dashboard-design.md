# Agent Dashboard Design References

Stored 2026-02-09. These inform War Room architecture decisions.

## 1. @pbteja1998 — Mission Control Guide
**Source:** https://x.com/pbteja1998/status/2017662163540971756
**Likes:** 8.2K

Key patterns:
- Named agents with SOUL files (personality) + shared Convex DB
- Task lifecycle: **Inbox → Assigned → In Progress → Review → Done**
- 15-min heartbeat crons (staggered so agents don't pile up)
- @mentions + thread subscriptions for natural conversation flow
- Daily standup cron → summary to Telegram
- WORKING.md per agent = current task state
- Mission Control = central dashboard showing all agent activity

**Relevance:** This IS what we're building. Our War Room = their Mission Control. Supabase = their Convex. We need heartbeats, @mentions, thread subscriptions, daily standup.

## 2. @NickSpisak_ — AI Agent Architecture Guide
**Source:** https://x.com/NickSpisak_/status/2020579444067573850

Six-layer stack:
1. **Harness** — orchestration layer
2. **LLM** — model selection per task
3. **Skills** — reusable capabilities
4. **Memory** — shared knowledge base
5. **Tools** — external integrations
6. **Data** — persistent storage

Maps different client profiles to specific stacks. Shows how to match architecture to use case.

**Relevance:** Validates our layered approach (engine → API → UI). Memory layer = our Kuato/archival system.

## 3. arxiv — Team of Rivals (2601.14351)
**Source:** https://arxiv.org/abs/2601.14351

Key insight: Agents with **opposing incentives** (planners vs critics) catch 90% of errors before user exposure. Separation of reasoning from execution.

**Relevance:** Our quality layer — critic agents reviewing work before marking done. Validates the Review step in task lifecycle.

## 4. AgentPacks
**Source:** https://www.agentpacks.ai/

Pre-built SOUL configs for OpenClaw. Shows the market for agent team templates.

**Relevance:** Template marketplace concept. Our Daimyo profiles could be shareable/importable.

---

## Design Decisions Informed by These

- **Task lifecycle:** Inbox → Assigned → In Progress → Review → Done (from #1)
- **Overview → drill-down:** Main page = project health cards, click → per-project kanban
- **Heartbeat system:** 15-min agent check-ins (from #1)
- **In-app chat:** Replace Discord with War Room native chat (from #1's thread model)
- **Critic agents:** Review step catches errors before Done (from #3)
- **Future:** iOS/macOS native app, away from Discord entirely
