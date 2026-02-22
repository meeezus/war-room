#!/bin/bash
# post-council.sh — Post a council session to War Room API
# Usage: ./scripts/post-council.sh <json-file>
# Example: ./scripts/post-council.sh ./council-result.json
#
# JSON file format:
# {
#   "topic": "...",
#   "council_type": "full",
#   "reviews": [{"name": "Ed", "verdict": "approve", "voice_text": "..."}],
#   "synthesis": "...",
#   "recommendation": "...",
#   "dissent": "..."
# }

set -euo pipefail

WAR_ROOM_URL="${WAR_ROOM_URL:-http://localhost:3000}"
WAR_ROOM_API_KEY="${WAR_ROOM_API_KEY:-}"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <json-file>"
  echo "  JSON file must contain: topic, reviews[], synthesis, recommendation, dissent"
  echo ""
  echo "Environment variables:"
  echo "  WAR_ROOM_URL     (default: http://localhost:3000)"
  echo "  WAR_ROOM_API_KEY (optional — required if server has WAR_ROOM_API_KEY set)"
  exit 1
fi

JSON_FILE="$1"

if [[ ! -f "$JSON_FILE" ]]; then
  echo "Error: file not found: $JSON_FILE"
  exit 1
fi

echo "Posting council session to $WAR_ROOM_URL/api/council..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$WAR_ROOM_URL/api/council" \
  -H "Content-Type: application/json" \
  ${WAR_ROOM_API_KEY:+-H "x-api-key: $WAR_ROOM_API_KEY"} \
  -d @"$JSON_FILE")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [[ "$HTTP_CODE" == "201" ]]; then
  SESSION_ID=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin)['session']['id'])" 2>/dev/null || echo "unknown")
  echo "Council session posted!"
  echo "  ID: $SESSION_ID"
  echo "  URL: $WAR_ROOM_URL/council/$SESSION_ID"
else
  echo "Failed (HTTP $HTTP_CODE)"
  echo "$BODY"
  exit 1
fi
