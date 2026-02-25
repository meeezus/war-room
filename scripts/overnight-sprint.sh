#!/bin/bash
# Overnight autonomous sprint — runs via tmux, no approval needed
# Usage: tmux new-session -d -s overnight 'bash scripts/overnight-sprint.sh'

set -e
cd /Users/michaelenriquez/Code/war-room

LOG="/tmp/overnight-sprint-$(date +%Y%m%d-%H%M%S).log"
echo "=== Overnight Sprint started at $(date) ===" | tee "$LOG"
echo "Log: $LOG"

git checkout main && git pull origin main
git checkout -b feature/overnight-reflexive-eval 2>/dev/null || git checkout feature/overnight-reflexive-eval

CLAUDE="env -u CLAUDECODE claude --dangerously-skip-permissions --model claude-sonnet-4-6 --print"

# ─── Task 1: Wire reflexive evaluator for stalled objectives ─────────────
echo "=== T1: Wire reflexive evaluator ===" | tee -a "$LOG"
$CLAUDE "$(cat <<'PROMPT'
You are working in /Users/michaelenriquez/Code/shogunate/engine/evaluator.py

The function check_stalled_objectives() at the bottom of the file currently just emits an 'objective_stalled' event when an objective has no active mission or pending proposal. It needs to also call _create_reflexive_proposal() to auto-propose the next mission.

Here's what to do:

1. Read /Users/michaelenriquez/Code/shogunate/engine/evaluator.py fully
2. In check_stalled_objectives(), after the stalled alert fires (the emit call), add a call to create a reflexive proposal. The function _create_reflexive_proposal() exists in the same file but requires a parent_mission and objective. For stalled objectives with NO prior missions, we need a different approach — call the LLM directly to propose the first step based on success_criteria.

3. Add a new function create_initial_proposal(objective) that:
   - Takes the objective dict
   - Calls Claude (using subprocess like _create_reflexive_proposal does) with a prompt like: "Given this objective with success criteria: {criteria}, what is the single most important first mission to create? Respond with a JSON object: {title, description, domain}"
   - Uses create_proposal() to insert it
   - Links it to the objective_id

4. In check_stalled_objectives(), for stalled objectives:
   - If the objective has prior completed missions: call _create_reflexive_proposal with the most recent completed mission
   - If no prior missions at all: call create_initial_proposal(objective)
   - Only do this for objectives that haven't been alerted yet (_stalled_alerted set)

5. Use EVALUATOR_MODEL from config for the LLM call

Do NOT modify any other files. Write the changes directly.
PROMPT
)" 2>&1 | tee -a "$LOG"

# ─── Task 2: Fix health endpoint ─────────────────────────────────────────
echo "=== T2: Fix health endpoint ===" | tee -a "$LOG"
$CLAUDE "$(cat <<'PROMPT'
You are working in /Users/michaelenriquez/Code/war-room

The /health page shows "Failed to reach health endpoint".

1. Read app/api/health/route.ts
2. Read app/health/page.tsx
3. The health route checks Supabase connectivity, Claude CLI, and poller status. Figure out why it returns 503 — likely the Claude CLI check or poller check is failing.
4. Fix it so the health page works. The key things to check:
   - Supabase should work (we have the env vars)
   - Claude CLI check: just verify `claude --version` runs
   - Poller check: verify com.warroom.poller plist is loaded via launchctl
5. If checks are too strict (requiring services that aren't always running), make them graceful — show status per check rather than failing the whole endpoint.

Write fixes directly to the files.
PROMPT
)" 2>&1 | tee -a "$LOG"

# ─── Task 3: Folio log scanner in patrol ──────────────────────────────────
echo "=== T3: Folio log scanner ===" | tee -a "$LOG"
$CLAUDE "$(cat <<'PROMPT'
You are working in /Users/michaelenriquez/Code/shogunate/engine/patrol.py

Patrol currently only scans code repos. Add a Folio conversation quality scanner.

1. Read engine/patrol.py fully to understand the pattern
2. Read engine/config.py for Supabase connection details
3. Add a new function scan_folio_conversations() that:
   - Queries Supabase table "conversations" or "messages" in the Folio project (check folio's schema — the Supabase URL is the same: qcklchfcnxddvigjrwed.supabase.co)
   - Looks at the last 24 hours of conversations
   - For each conversation, checks if the AI response was adequate:
     a. Response exists (not empty/error)
     b. Response addresses what the user asked
     c. If user asked about specific content (like a name), check if similar content exists in the notes table
   - Uses Haiku (CHEAP_MODEL from config) to evaluate: "Did this response adequately address the user's question? Reply YES or NO with a brief reason."
   - Returns discoveries for any NO responses

4. Wire scan_folio_conversations() into run_patrol() alongside the repo scans
5. Create discoveries with category="quality", severity based on how bad the miss was

Be conservative with the LLM calls — only evaluate conversations where the user seemed unsatisfied (short follow-ups, repeated questions, explicit complaints).
PROMPT
)" 2>&1 | tee -a "$LOG"

# ─── Task 4: Discovery browser in health/patrol page ─────────────────────
echo "=== T4: Discovery browser UI ===" | tee -a "$LOG"
$CLAUDE "$(cat <<'PROMPT'
You are working in /Users/michaelenriquez/Code/war-room

Add a discovery browser to the existing /health page (or replace it if the health page is mostly broken). This shows patrol findings from the discoveries table.

1. Read supabase/migrations/20260225000001_discoveries.sql for the schema
2. Read app/health/page.tsx and app/api/health/route.ts
3. Read lib/queries.ts for existing query patterns

Create:
- GET /api/discoveries route that fetches from the discoveries table with optional filters (status, severity, repo)
- Update /health page OR create /discoveries page that shows:
  - Filter bar: severity toggles (critical/warning/info), status tabs (pending/approved/dismissed)
  - List of discoveries: severity icon, title, repo, agent, date, approve/dismiss buttons
  - Approve calls POST /api/brief/action with action type approve_discovery
  - Dismiss calls POST /api/brief/action with action type dismiss_discovery
- Link from the Patrol card on the dashboard ribbon to this page
- Use semantic CSS classes (bg-background, text-foreground, border-border etc) — NO hardcoded zinc colors

Match the existing stealth dark aesthetic. Keep it simple — no sidebar, just filter bar + list.
PROMPT
)" 2>&1 | tee -a "$LOG"

# ─── Commit and PR ───────────────────────────────────────────────────────
echo "=== Committing ===" | tee -a "$LOG"
cd /Users/michaelenriquez/Code/war-room
git add -A
git commit -m "feat: reflexive evaluator, folio log scanner, discovery browser, health fix

- Wire stalled objectives to auto-propose initial missions via LLM
- Add Folio conversation quality scanner to patrol
- Discovery browser UI on /discoveries (or /health)
- Fix health endpoint graceful degradation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || echo "Nothing to commit"

git push -u origin feature/overnight-reflexive-eval 2>&1 | tee -a "$LOG"

gh pr create \
  --title "feat: reflexive evaluator, folio scanner, discovery browser" \
  --body "## Summary
- Reflexive evaluator auto-proposes missions for stalled objectives
- Folio conversation quality scanner in patrol
- Discovery browser UI with approve/dismiss
- Health endpoint graceful degradation

## Test plan
- [ ] Create objective → evaluator proposes first mission automatically
- [ ] Patrol runs → Folio conversations scanned for quality
- [ ] /discoveries page shows patrol findings with filters
- [ ] /health page loads without 503

🤖 Generated with [Claude Code](https://claude.com/claude-code)" 2>&1 | tee -a "$LOG"

echo "=== Overnight Sprint complete at $(date) ===" | tee -a "$LOG"
echo "PR created. Review in the morning."
