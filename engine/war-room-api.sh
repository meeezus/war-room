#!/usr/bin/env bash
# War Room API — Supabase REST wrapper for CC agent
# Source this file: source engine/war-room-api.sh

# Load env from war-room project
_WR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$_WR_DIR/.env.local" ]]; then
  export $(grep -v '^#' "$_WR_DIR/.env.local" | xargs)
fi

_WR_URL="${NEXT_PUBLIC_SUPABASE_URL}"
_WR_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

_wr_curl() {
  local method="$1" path="$2" data="$3"
  /usr/bin/curl -s -X "$method" "${_WR_URL}/rest/v1/${path}" \
    -H "apikey: ${_WR_KEY}" \
    -H "Authorization: Bearer ${_WR_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    ${data:+-d "$data"}
}

# Update agent status
# Schema: id, name, display_name, domain, model, level, status(online|idle|busy|offline), current_mission_id
# Usage: wr_update_agent <id> <status> [mission_context]
wr_update_agent() {
  local id="$1" status="$2"
  _wr_curl PATCH "agent_status?id=eq.${id}" "{\"status\":\"$status\"}" > /dev/null
}

# Create a task in the tasks table
# Usage: wr_create_task <board_id> <project_id> <title> [status]
wr_create_task() {
  local board_id="$1" project_id="$2" title="$3" status="${4:-todo}"
  _wr_curl POST "tasks" "{\"board_id\":\"$board_id\",\"project_id\":\"$project_id\",\"title\":\"$title\",\"status\":\"$status\"}"
}

# Update a task status
# Usage: wr_update_task <id> <status>
wr_update_task() {
  local id="$1" status="$2"
  local now
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [[ "$status" == "done" ]]; then
    _wr_curl PATCH "tasks?id=eq.${id}" "{\"status\":\"done\",\"completed_at\":\"$now\",\"updated_at\":\"$now\"}" > /dev/null
  else
    _wr_curl PATCH "tasks?id=eq.${id}" "{\"status\":\"$status\",\"updated_at\":\"$now\"}" > /dev/null
  fi
}

# Create an event in the events table
# Schema: type(proposal_created|mission_started|mission_completed|mission_failed|step_started|step_completed|step_failed|agent_action|user_request), agent, message, metadata(jsonb)
# Usage: wr_create_event <type> <agent> <message> [metadata_json]
wr_create_event() {
  local type="$1" agent="$2" message="$3" metadata="${4:-{}}"
  _wr_curl POST "events" "{\"type\":\"$type\",\"agent\":\"$agent\",\"message\":\"$message\",\"metadata\":$metadata}" > /dev/null
}

# Update project status
# Usage: wr_update_project <id> <status>
wr_update_project() {
  local id="$1" status="$2"
  _wr_curl PATCH "projects?id=eq.${id}" "{\"status\":\"$status\",\"updated_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > /dev/null
}

echo "War Room API loaded" >&2
