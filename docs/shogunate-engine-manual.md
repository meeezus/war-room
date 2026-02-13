# Shogunate Engine Manual

The execution engine that turns proposals into missions, assigns them to Daimyo agents, and runs steps via Claude CLI with memory and affinity.

## Architecture Overview

```
Proposal → Approve → Mission → Steps → Execute via Claude CLI
                                  ↓
                          Memory Extraction (Haiku)
                                  ↓
                          agent_memory table
                                  ↓
                    Injected into next execution prompt
```

**Tables (Supabase):**
- `proposals` — incoming work requests
- `missions` — approved proposals decomposed into steps
- `steps` — individual execution units assigned to Daimyo
- `war_room_events` — event log for all system activity
- `agent_memory` — learnings extracted from step outputs
- `agent_relationships` — affinity scores between Daimyo pairs
- `agent_status` — current state of each agent

**Daimyo (Agents):**

| ID | Name | Domain | SKILL File |
|----|------|--------|------------|
| `ed` | Ed | engineering | `Ed-SKILL.md` |
| `light` | Light | product | `Light-SKILL.md` |
| `toji` | Toji | commerce | `Vex.md` |
| `power` | Makima | influence | `Spark.md` |
| `major` | Major | operations | `Bolt-SKILL.md` |

SKILL files live at `~/Shugyo/Shogunate/Daimyo/`.

---

## 1. Proposals

### Create a proposal

```python
from engine.proposal import create_proposal

proposal = create_proposal(
    title="Fix login redirect bug",
    description="Users hitting /dashboard before auth completes get a blank page. Need to add auth guard.",
    domain="engineering",           # engineering | product | commerce | influence | operations
    requested_by="Sensei",
    project_id="uuid-here",         # optional, links to a project
    source="manual",                # manual | discord | cron | trigger
)

print(proposal["id"])    # UUID
print(proposal["status"])  # "pending"
```

### List pending proposals

```python
from engine.proposal import list_pending

pending = list_pending()
for p in pending:
    print(f"{p['title']} — {p['domain']} — requested by {p['requested_by']}")
```

### Approve / Reject

```python
from engine.proposal import approve, reject

# Approve — this makes it eligible for the poller to pick up
approve("proposal-uuid", approved_by="Sensei")

# Reject with reason
reject("proposal-uuid", reason="Not a priority right now")
```

---

## 2. Missions

When a proposal is approved, `run_pending()` converts it into a mission with steps.

### How mission creation works

```python
from engine.mission import run_pending

# This is called automatically by the poller every 10s
# But you can also call it manually:
new_missions = run_pending()

for m in new_missions:
    print(f"Mission: {m['title']}")
    print(f"Assigned to: {m['assigned_to']}")
    print(f"Steps: {len(m['steps'])}")
```

### Default step decomposition (K2.5 heuristic)

Every proposal gets 3 steps:
1. **Research** — investigate and plan
2. **Implement** — write the code/content
3. **Review** — validate the work

### Affinity-aware assignment

Steps are assigned to Daimyo by domain:
- `engineering` → Ed
- `product` → Light
- `commerce` → Toji
- `influence` → Makima (power)
- `operations` → Major

If a step's domain doesn't have a direct match, the engine picks the agent with the highest affinity score to the mission's primary assignee.

```python
from engine.relationships import get_affinity

# Check affinity between two agents
score = get_affinity("ed", "light")  # Returns 0.0-1.0
```

### Create a mission manually

```python
from engine.mission import create_mission

mission = create_mission(
    proposal_id="proposal-uuid",
    title="Fix login redirect bug",
    description="Add auth guard to /dashboard route",
    assigned_to="ed",
    steps=[
        {"title": "Research auth patterns", "description": "...", "kind": "research", "domain": "engineering"},
        {"title": "Implement auth guard", "description": "...", "kind": "code", "domain": "engineering"},
        {"title": "Test the fix", "description": "...", "kind": "review", "domain": "engineering"},
    ],
    project_id="optional-uuid",
)
```

---

## 3. Step Execution

### How it works

1. Executor loads the Daimyo's SKILL.md file
2. Retrieves relevant memories from `agent_memory` and appends them to the prompt
3. Selects the model (Sonnet default, Opus for complex multi-domain missions)
4. Spawns `claude -p --system-prompt <skill+memories> --model <model> --dangerously-skip-permissions <step_description>`
5. Captures stdout/stderr
6. Updates step status in Supabase (completed/failed)
7. Emits event to `war_room_events`
8. Extracts memories from output via Haiku
9. Checks if all mission steps are done → marks mission completed/failed
10. Applies affinity drift between collaborating agents

### Execute the next queued step manually

```python
from engine.executor import execute_next

result = execute_next()
if result:
    print(f"Step: {result['title']} → {result['status']}")
    print(f"Output: {result.get('output', '')[:200]}")
else:
    print("No queued steps")
```

### Execute all steps for a mission

```python
from engine.executor import execute_mission

results = execute_mission("mission-uuid")
for step in results:
    print(f"{step['title']}: {step['status']}")
```

### Model selection

| Condition | Model | Cost |
|-----------|-------|------|
| Default | Sonnet (`claude-sonnet-4-5-20250929`) | ~$3/M tokens |
| Step has `escalate=true` | Opus (`claude-opus-4-6`) | ~$15/M tokens |
| Mission spans 3+ domains | Opus (auto-escalation) | ~$15/M tokens |
| Memory extraction | Haiku (`claude-haiku-4-5-20251001`) | ~$0.25/M tokens |

Override via environment:
```bash
export WORKER_MODEL="claude-sonnet-4-5-20250929"
export ORCHESTRATOR_MODEL="claude-opus-4-6"
export CHEAP_MODEL="claude-haiku-4-5-20251001"
```

### Atomic claiming

When the poller calls `execute_next()`, it atomically claims the step:
```sql
UPDATE steps SET status='running' WHERE id=X AND status='queued'
```
If another poller instance already claimed it, the update returns empty and execution is skipped. This prevents double-execution.

---

## 4. The Poller (10s Daemon)

### Start manually

```bash
cd ~/Code/war-room
python -m engine.poller
```

Output:
```
22:30:01 [poller] Shogunate Poller started
22:30:01 [poller]   Interval: 10s
22:30:01 [poller]   State: ~/.warroom/poller_state.json
22:30:11 [poller] Created 1 mission(s) from approved proposals
22:30:11 [poller]   → Fix login redirect bug (assigned: ed)
22:30:11 [poller] Executed step: Research: Fix login redirect bug → completed
22:30:21 [poller] Executed step: Implement: Fix login redirect bug → completed
```

### What it does each cycle (every 10s)

1. **run_pending()** — converts approved proposals → missions with steps
2. **execute_next()** — picks up and executes the next queued step
3. **detect_stale_steps()** — finds steps stuck in `running` past their timeout, marks as failed
4. **heartbeat** — emits a heartbeat event with cycle summary

### Install as LaunchAgent (auto-start on boot)

```bash
# Load (starts immediately and on boot)
launchctl load ~/Library/LaunchAgents/com.warroom.poller.plist

# Unload (stops)
launchctl unload ~/Library/LaunchAgents/com.warroom.poller.plist

# Check status
launchctl list | grep warroom

# View logs
tail -f /tmp/warroom-poller.log
tail -f /tmp/warroom-poller.err
```

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `POLL_INTERVAL` | `10` | Seconds between cycles |
| `SUPABASE_URL` | (required) | Supabase project URL |
| `SUPABASE_KEY` | (required) | Supabase service role key |

### Error resilience

- Each cycle is wrapped in try/except — one failure doesn't crash the loop
- After 5 consecutive errors, backs off to 60s cycles
- State persisted to `~/.warroom/poller_state.json` (last run, steps processed, error count)

---

## 5. Memory System

### How extraction works

After each successful step, the executor calls Haiku to extract 1-3 learnings:

```
Step output → Haiku → JSON array of memories → agent_memory table
```

Each memory has:
- `memory_type`: insight, pattern, decision, solution, warning
- `content`: 1-2 sentence description
- `tags`: 2-4 relevant tags
- `confidence`: 0.0-1.0

### How injection works

Before spawning Claude for a step, the executor:
1. Queries `agent_memory` for the agent's active memories (top 5 by confidence)
2. Formats them as markdown
3. Appends to the SKILL.md system prompt

The agent sees:
```
[...SKILL.md content...]

## Recent Memories
- [solution] Fixed auth by adding null check before profile access (confidence: 0.9)
- [pattern] Supabase RLS policies block service role when row-level is enabled (confidence: 0.8)
- [warning] Three.js 0.182 incompatible with drei SoftShadows PCSS shaders (confidence: 0.7)
```

### Query memories manually

```python
from engine.memory import get_relevant_memories, format_memories_section

# Get Ed's recent memories
memories = get_relevant_memories("ed", limit=10)
for m in memories:
    print(f"[{m['memory_type']}] {m['content']} ({m['confidence']})")

# Format for prompt injection
section = format_memories_section(memories)
print(section)
```

### Store a memory manually

```python
from engine.config import supabase

supabase.table("agent_memory").insert({
    "agent_id": "ed",
    "memory_type": "solution",
    "content": "Use VSM shadows instead of drei SoftShadows for three.js 0.182 compat",
    "tags": ["three.js", "shadows", "drei"],
    "confidence": 0.95,
    "status": "active",
}).execute()
```

---

## 6. Affinity & Drift

### Seeded relationships

The `agent_relationships` table has 15 seeded pairs (every Daimyo combination). Default affinities range from 0.3 to 0.85 based on domain proximity.

### Drift mechanics

After every mission completion, the executor applies drift to all collaborating agent pairs:

| Outcome | Delta | Cap |
|---------|-------|-----|
| Mission succeeded | +0.03 | 0.95 max |
| Mission failed | -0.02 | 0.10 min |

Each drift is recorded in the `drift_history` JSONB array on the relationship row.

### Check relationships

```python
from engine.relationships import get_affinity, get_best_collaborator

# Direct affinity lookup
print(get_affinity("ed", "light"))  # e.g., 0.78

# Who should collaborate with Ed on an unknown domain?
best = get_best_collaborator("ed", ["light", "toji", "power", "major"])
print(f"Best collaborator for Ed: {best}")
```

---

## 7. Events

Every significant action emits an event to `war_room_events`.

### Event types

| Event | When |
|-------|------|
| `proposal_created` | New proposal inserted |
| `proposal_approved` | Proposal approved |
| `proposal_rejected` | Proposal rejected |
| `mission_started` | Mission created from proposal |
| `mission_completed` | All steps succeeded |
| `mission_failed` | At least one step failed |
| `step_completed` | Step finished successfully |
| `step_failed` | Step failed (error or timeout) |
| `step_stale` | Poller detected stuck step |
| `heartbeat` | Poller cycle summary |

### Emit manually

```python
from engine.events import emit

emit("user_request", {
    "agent": "system",
    "title": "Manual Test",
    "message": "Testing event emission",
})
```

### Query events

```sql
SELECT * FROM war_room_events
WHERE agent_id = 'ed'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 8. SKILL Files

Each Daimyo has a SKILL.md file that becomes their system prompt. Structure:

```markdown
# Name — VP Title
*Domain: X | Level: 2 | Model: Claude Sonnet 4.5*

## Domain Expertise (what they know)
## Samurai Workers (who they can delegate to)
## Capabilities by Level (unlockable progression)
## Activation Triggers (when to invoke them)
## Response Patterns (standard operating procedures)
## Example Interactions (few-shot examples)
## Delegation Protocol (how to spawn workers)
## Hard Bans (absolute constraints — NEVER violate)
## Notes (personality and preferences)
```

### Hard Bans (per agent)

**Ed:** No prod deploys without tests, no force push, no skipping review, no committing secrets
**Light:** No features without metrics, no scope creep without trade-offs, no ignoring user data
**Toji:** No unauthorized pricing, no contract changes, no unsubstantiated revenue claims
**Makima:** No posting without brand review, no engaging trolls, no unauthorized partnerships
**Major:** No infra changes without rollback, no deleting prod data, no disabling monitoring

---

## 9. Role Cards (TypeScript)

Role cards provide frontend metadata for each agent.

```typescript
import { getRoleCard, getAllRoleCards } from '@/lib/role-cards'

const ed = getRoleCard('ed')
console.log(ed.title)      // "The Architect"
console.log(ed.hardBans)   // ["Never deploy to production without tests", ...]
console.log(ed.escalation) // "Escalate when: production incident, ..."

// Get all unique agents
const all = getAllRoleCards()  // 6 agents (deduped)
```

Vox-style fields on each card:

| Field | Type | Purpose |
|-------|------|---------|
| `inputs` | `string[]` | What the agent needs to start |
| `outputs` | `string[]` | What the agent produces |
| `definitionOfDone` | `string[]` | Completion criteria |
| `hardBans` | `string[]` | Things agent must NEVER do |
| `escalation` | `string` | When to escalate to Sensei |
| `metrics` | `string[]` | How performance is measured |

---

## 10. End-to-End Example

### The full loop: idea → execution → memory

```bash
# Terminal 1: Start the poller
cd ~/Code/war-room
export SUPABASE_URL="https://qcklchfcnxddvigjrwed.supabase.co"
export SUPABASE_KEY="your-service-role-key"
python -m engine.poller
```

```python
# Terminal 2: Create and approve a proposal
from engine.proposal import create_proposal, approve

# Step 1: Create proposal
p = create_proposal(
    title="Add rate limiting to API endpoints",
    description="Implement rate limiting middleware for all /api routes. Use sliding window algorithm, 100 req/min per IP.",
    domain="engineering",
)
print(f"Created: {p['id']}")

# Step 2: Approve it
approve(p["id"])
print("Approved — poller will pick it up within 10s")
```

**What happens next (automatically):**

1. **Poller** calls `run_pending()` → creates mission assigned to Ed with 3 steps
2. **Poller** calls `execute_next()` → claims "Research: Add rate limiting" step
3. **Executor** loads Ed's SKILL.md + recent memories → spawns `claude -p` on Sonnet
4. Claude researches rate limiting approaches, outputs findings
5. **Memory extraction** (Haiku) extracts learnings: "sliding window via Redis sorted sets is most efficient"
6. Step marked completed, event emitted
7. **Next cycle** → "Implement: Add rate limiting" step executes with the new memory injected
8. **Next cycle** → "Review: Add rate limiting" step validates the work
9. **Mission completed** → affinity drift applied to all collaborating agents
10. Events visible in dashboard, memories available for future missions

### Check results

```python
from engine.config import supabase

# Check mission status
missions = supabase.table("missions").select("*").order("created_at", desc=True).limit(1).execute()
print(missions.data[0])

# Check memories created
memories = supabase.table("agent_memory").select("*").eq("agent_id", "ed").order("created_at", desc=True).limit(5).execute()
for m in memories.data:
    print(f"[{m['memory_type']}] {m['content']}")

# Check events
events = supabase.table("war_room_events").select("*").order("created_at", desc=True).limit(10).execute()
for e in events.data:
    print(f"{e['event_type']}: {e['title']}")
```

---

## Environment Setup

Required env vars (set in `.env.local` or export in shell):

```bash
export SUPABASE_URL="https://qcklchfcnxddvigjrwed.supabase.co"
export SUPABASE_KEY="your-supabase-service-role-key"

# Optional overrides
export WORKER_MODEL="claude-sonnet-4-5-20250929"
export ORCHESTRATOR_MODEL="claude-opus-4-6"
export CHEAP_MODEL="claude-haiku-4-5-20251001"
export POLL_INTERVAL="10"
```

The `claude` CLI must be installed and on PATH.

---

## File Map

```
engine/
  config.py          — Supabase client, model constants, Daimyo registry
  events.py          — Event emission to war_room_events
  executor.py        — Step execution via claude CLI, memory hooks, drift
  memory.py          — Memory extraction (Haiku) and injection
  mission.py         — Mission creation with affinity-aware assignment
  poller.py          — 10s polling daemon
  proposal.py        — Proposal CRUD
  relationships.py   — Affinity queries and drift mechanics

lib/
  types.ts           — TypeScript interfaces (RoleCard with Vox fields)
  role-cards.ts      — Role card data for all agents

~/Shugyo/Shogunate/Daimyo/
  Ed-SKILL.md        — Engineering VP system prompt
  Light-SKILL.md     — Product VP system prompt
  Vex.md             — Commerce VP system prompt (Toji)
  Spark.md           — Influence VP system prompt (Makima)
  Bolt-SKILL.md      — Operations VP system prompt (Major)

~/Library/LaunchAgents/
  com.warroom.poller.plist — Auto-start poller daemon
```
