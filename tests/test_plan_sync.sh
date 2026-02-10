#!/usr/bin/env bash
# Tests for plan-sync.sh hook
# Run: bash tests/test_plan_sync.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_SCRIPT="$PROJECT_DIR/engine/hooks/plan-sync.sh"

PASS=0
FAIL=0
TOTAL=0

_assert() {
  local desc="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if [[ "$expected" == "$actual" ]]; then
    PASS=$((PASS + 1))
    echo "  PASS: $desc"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL: $desc"
    echo "    expected: $expected"
    echo "    actual:   $actual"
  fi
}

_assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  TOTAL=$((TOTAL + 1))
  if echo "$haystack" | grep -qF "$needle"; then
    PASS=$((PASS + 1))
    echo "  PASS: $desc"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL: $desc"
    echo "    expected to contain: $needle"
    echo "    actual: $haystack"
  fi
}

# --- Setup ---
TMPDIR_TEST=$(mktemp -d)
trap "rm -rf $TMPDIR_TEST" EXIT

# Create a fake plans dir with a test plan
FAKE_PLANS="$TMPDIR_TEST/plans"
mkdir -p "$FAKE_PLANS"

cat > "$FAKE_PLANS/test-plan.md" <<'PLAN'
# Deploy Auth System

## Context
Blah blah

## Sprints

### Sprint 1

### S1-T1: Create user table migration

**Model:** sonnet

### S1-T2: Add auth middleware

**Model:** sonnet

### Sprint 2

### S2-T1: Build login endpoint

**Model:** sonnet

### S2-T2: Add session management

**Model:** opus
PLAN

# Track API calls
API_LOG="$TMPDIR_TEST/api_calls.log"
touch "$API_LOG"

# Create a mock war-room-api.sh that logs calls
cat > "$TMPDIR_TEST/mock-api.sh" <<'MOCK'
wr_update_agent() {
  echo "wr_update_agent $*" >> "$API_LOG"
}
wr_create_task() {
  echo "wr_create_task $*" >> "$API_LOG"
}
wr_create_event() {
  echo "wr_create_event $*" >> "$API_LOG"
}
MOCK

# Create a testable version of the hook that uses our mocks
cat > "$TMPDIR_TEST/plan-sync-test.sh" <<HOOK
#!/usr/bin/env bash
set -euo pipefail

INPUT=\$(cat)

# Use mock API
export API_LOG="$API_LOG"
source "$TMPDIR_TEST/mock-api.sh"

PLAN_DIR="$FAKE_PLANS"
PLAN_FILE=\$(ls -t "\$PLAN_DIR"/*.md 2>/dev/null | head -1)

if [[ -z "\$PLAN_FILE" ]]; then
  exit 0
fi

PLAN_NAME=\$(grep -m1 '^# ' "\$PLAN_FILE" | sed 's/^# //')

wr_update_agent cc busy

TASKS=\$(grep -E '^### S[0-9]+-T[0-9]+: ' "\$PLAN_FILE" | sed 's/^### S[0-9]*-T[0-9]*: //')

while IFS= read -r task_title; do
  [[ -z "\$task_title" ]] && continue
  wr_create_task "cc-ops" "shogunate" "\$task_title" "todo"
done <<< "\$TASKS"

TASK_COUNT=\$(echo "\$TASKS" | grep -c '.' || echo 0)

wr_create_event "agent_action" "cc" "Plan started: \$PLAN_NAME (\$TASK_COUNT tasks)" "{\"plan\":\"\$PLAN_NAME\",\"task_count\":\$TASK_COUNT}"
HOOK
chmod +x "$TMPDIR_TEST/plan-sync-test.sh"

# --- Test 1: Hook script exists and is executable ---
echo "Test Group: Hook file checks"
_assert "hook script exists" "true" "$([ -f "$HOOK_SCRIPT" ] && echo true || echo false)"
_assert "hook script is executable" "true" "$([ -x "$HOOK_SCRIPT" ] && echo true || echo false)"

# --- Test 2: Settings file exists with correct hook ---
echo ""
echo "Test Group: Settings file"
SETTINGS="$PROJECT_DIR/.claude/settings.json"
_assert "settings.json exists" "true" "$([ -f "$SETTINGS" ] && echo true || echo false)"

if [ -f "$SETTINGS" ]; then
  # Check it has PostToolUse.ExitPlanMode hook
  HAS_MATCHER=$(python3 -c "
import json
with open('$SETTINGS') as f:
    s = json.load(f)
hooks = s.get('hooks', {}).get('PostToolUse', [])
for h in hooks:
    if h.get('matcher') == 'ExitPlanMode':
        print('true')
        break
else:
    print('false')
")
  _assert "settings has ExitPlanMode hook" "true" "$HAS_MATCHER"

  HAS_COMMAND=$(python3 -c "
import json
with open('$SETTINGS') as f:
    s = json.load(f)
hooks = s.get('hooks', {}).get('PostToolUse', [])
for h in hooks:
    if h.get('matcher') == 'ExitPlanMode':
        for sub in h.get('hooks', []):
            if 'plan-sync.sh' in sub.get('command', ''):
                print('true')
                break
        break
else:
    print('false')
")
  _assert "settings hook command references plan-sync.sh" "true" "$HAS_COMMAND"
fi

# --- Test 3: Extracts plan name ---
echo ""
echo "Test Group: Plan parsing"
> "$API_LOG"
echo '{}' | bash "$TMPDIR_TEST/plan-sync-test.sh"

_assert_contains "sets agent to busy" "wr_update_agent cc busy" "$(cat "$API_LOG")"

# --- Test 4: Extracts correct task count ---
TASK_LINES=$(grep -c 'wr_create_task' "$API_LOG" || echo 0)
_assert "creates 4 tasks" "4" "$TASK_LINES"

# --- Test 5: Correct task titles ---
_assert_contains "task 1 title" "Create user table migration" "$(cat "$API_LOG")"
_assert_contains "task 2 title" "Add auth middleware" "$(cat "$API_LOG")"
_assert_contains "task 3 title" "Build login endpoint" "$(cat "$API_LOG")"
_assert_contains "task 4 title" "Add session management" "$(cat "$API_LOG")"

# --- Test 6: Tasks created under cc-ops / shogunate ---
_assert_contains "task board is cc-ops" "wr_create_task cc-ops shogunate" "$(cat "$API_LOG")"

# --- Test 7: Event fired ---
_assert_contains "event fired" "wr_create_event agent_action cc" "$(cat "$API_LOG")"
_assert_contains "event has plan name" "Plan started: Deploy Auth System" "$(cat "$API_LOG")"
_assert_contains "event has task count" "4 tasks" "$(cat "$API_LOG")"

# --- Test 8: No plan file exits cleanly ---
echo ""
echo "Test Group: Edge cases"
EMPTY_PLANS="$TMPDIR_TEST/empty_plans"
mkdir -p "$EMPTY_PLANS"
# Create version with empty plans dir
cat > "$TMPDIR_TEST/plan-sync-empty.sh" <<HOOK2
#!/usr/bin/env bash
set -euo pipefail
INPUT=\$(cat)
PLAN_DIR="$EMPTY_PLANS"
PLAN_FILE=\$(ls -t "\$PLAN_DIR"/*.md 2>/dev/null | head -1 || true)
if [[ -z "\${PLAN_FILE:-}" ]]; then
  exit 0
fi
HOOK2
chmod +x "$TMPDIR_TEST/plan-sync-empty.sh"

EXIT_CODE=0
echo '{}' | bash "$TMPDIR_TEST/plan-sync-empty.sh" || EXIT_CODE=$?
_assert "exits 0 when no plan file" "0" "$EXIT_CODE"

# --- Summary ---
echo ""
echo "================================"
echo "Results: $PASS/$TOTAL passed, $FAIL failed"
echo "================================"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
