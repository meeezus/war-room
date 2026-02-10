# Agent Architecture Reference Tweets

Collection of tweets and threads on agent architecture patterns, saved from War Room planning session (2026-02-09).

---

## Six-Layer Agent Stack — @NickSpisak

The six-layer stack for production AI agents:
1. Perception (sensors/inputs)
2. Memory (context/state)
3. Reasoning (planning/decision)
4. Action (tool use/execution)
5. Feedback (evaluation/learning)
6. Coordination (multi-agent orchestration)

Key insight: Most "agent frameworks" only implement layers 3-4. Production systems need all six.

---

## Mission Control Pattern — @pbteja1998

Agent architecture inspired by NASA Mission Control:
- **Flight Director** = Orchestrator (makes go/no-go calls)
- **CAPCOM** = Single communication channel (prevents agent crosstalk)
- **Telemetry** = Observability layer (what are agents actually doing?)
- **Abort Procedures** = Kill switches and rollback plans

Key insight: The communication discipline (everything through CAPCOM) is what makes multi-agent reliable.

---

## Team of Rivals — @BrianRoemmele

Multiple agents with different models/perspectives evaluating the same proposal:
- Agent A (conservative) reviews for risk
- Agent B (aggressive) reviews for opportunity
- Agent C (domain expert) reviews for feasibility
- Human makes final call with all perspectives

Key insight: Diversity of agent "opinion" catches blind spots that a single agent misses.

---

## Closed Loop Execution — @VoxYZ

"One proposal service" pattern — all paths converge on the same pipeline:
- UI approval → proposal service → mission → execution
- CLI approval → proposal service → mission → execution
- Cron trigger → proposal service → mission → execution
- API trigger → proposal service → mission → execution

Key insight: Never have two paths to execution. One service, one pipeline, one place to add guardrails.

**This is the pattern we're implementing in the Shogunate's proposal→mission→daimyo bridge.**

---

## Agent Management Layer — @KSimback

The missing layer in most agent systems: management/supervision.
- Who monitors the agents?
- Who decides resource allocation?
- Who handles agent failure and retry?
- Who tracks cost and performance?

Key insight: Agent management is the hardest part — not agent creation.

---

## Antfarm — Ryan Carson (@ryancarson)

Agent system where you can watch agents work in real-time:
- Visual representation of agent state
- Real-time progress tracking
- Intervention points (pause, redirect, cancel)
- Post-mortem analysis of agent decisions

Key insight: Observability isn't optional — if you can't see what agents are doing, you can't trust them.

**War Room serves this function for the Shogunate.**

---

## Custom Chat Interface — Riley Ralmuto

Building custom chat UIs that wrap agent capabilities:
- Domain-specific UI (not generic chat)
- Structured inputs (forms + natural language)
- Progress visualization native to the domain
- Action buttons alongside conversation

Key insight: The best agent interface isn't always a chatbox — sometimes it's a dashboard with conversation embedded.

**Future consideration for War Room: embed Pip conversation alongside project views.**
