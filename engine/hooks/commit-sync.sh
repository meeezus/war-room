#!/usr/bin/env bash
# War Room Commit Sync — fires after Bash tool use
# Only acts on git commit commands in the war-room repo

set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Check if this was a git commit (look for "git commit" in the tool input)
TOOL_INPUT=$(echo "$INPUT" | /usr/bin/python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# Only proceed if this looks like a git commit
if [[ "$TOOL_INPUT" != *"git commit"* ]]; then
  exit 0
fi

# Check we're in the war-room repo
if [[ "$TOOL_INPUT" != *"war-room"* ]] && [[ "$(pwd)" != *"war-room"* ]]; then
  exit 0
fi

# Source the API utility
source /Users/michaelenriquez/Code/war-room/engine/war-room-api.sh 2>/dev/null

# Get the latest commit message
COMMIT_MSG=$(/usr/bin/git -C /Users/michaelenriquez/Code/war-room log -1 --pretty=%s 2>/dev/null || echo "unknown")

# Fire event
wr_create_event "agent_action" "cc" "Committed: $COMMIT_MSG" "{\"commit\":\"$COMMIT_MSG\"}"

# If this was also a push, set CC to idle
if [[ "$TOOL_INPUT" == *"git push"* ]]; then
  wr_update_agent cc idle
  wr_create_event "agent_action" "cc" "Push complete — going idle" "{}"
fi
