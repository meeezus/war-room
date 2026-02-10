#!/usr/bin/env bash
# War Room Plan Sync — fires after ExitPlanMode approval
# Reads the plan file, creates tasks in Supabase, sets CC to busy

set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Source the API utility
source /Users/michaelenriquez/Code/war-room/engine/war-room-api.sh 2>/dev/null

# Find the most recent plan file (skip agent sub-plans)
PLAN_DIR="/Users/michaelenriquez/.claude/plans"
PLAN_FILE=$(ls -t "$PLAN_DIR"/*.md 2>/dev/null | grep -v '\-agent-' | head -1)

if [[ -z "${PLAN_FILE:-}" ]]; then
  exit 0
fi

# Extract plan name from first H1
PLAN_NAME=$(grep -m1 '^# ' "$PLAN_FILE" | sed 's/^# //')

# Set CC to busy
wr_update_agent cc busy

# Extract task titles (### S1-T1: Title format)
TASKS=$(grep -E '^### S[0-9]+-T[0-9]+: ' "$PLAN_FILE" | sed 's/^### S[0-9]*-T[0-9]*: //')

# Create tasks in Supabase under cc-ops board
while IFS= read -r task_title; do
  [[ -z "$task_title" ]] && continue
  wr_create_task "cc-ops" "shogunate" "$task_title" "todo" > /dev/null 2>&1
done <<< "$TASKS"

# Count tasks created
TASK_COUNT=$(echo "$TASKS" | grep -c '.' || echo 0)

# Fire event
wr_create_event "agent_action" "cc" "Plan started: $PLAN_NAME ($TASK_COUNT tasks)" "{\"plan\":\"$PLAN_NAME\",\"task_count\":$TASK_COUNT}"

# Output nothing to stdout (hook should be silent)
