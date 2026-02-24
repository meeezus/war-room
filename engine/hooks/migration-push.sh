#!/bin/bash
# PostToolUse hook: auto-push Supabase migrations when .sql files are written
# Reads tool_input.file_path from stdin JSON, runs supabase db push if it's a migration

set -e

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Only trigger for migration SQL files
if [[ "$FILE_PATH" == *"supabase/migrations/"*".sql" ]]; then
  cd /Users/michaelenriquez/Code/war-room

  if command -v supabase &>/dev/null; then
    RESULT=$(supabase db push --include-all 2>&1 || true)

    if echo "$RESULT" | grep -q "Finished supabase db push"; then
      echo '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Supabase migration auto-pushed successfully."}}'
    elif echo "$RESULT" | grep -q "ERROR"; then
      ERROR_MSG=$(echo "$RESULT" | grep "ERROR" | head -1)
      echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"Migration auto-push failed: ${ERROR_MSG}. Run 'supabase db push --include-all' manually.\"}}"
    else
      echo '{}'
    fi
  else
    echo '{}'
  fi
else
  echo '{}'
fi
