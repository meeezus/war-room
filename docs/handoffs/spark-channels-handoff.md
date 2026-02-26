# Spark Integration Handoff — Wire Channels to Spark

## Context

War-room now has Slack-style channels in `/chat`. Channel messages need to flow to Spark Intelligence for memory ingestion.

**Spark endpoint:** `localhost:8787/ingest`
**Event format:** SparkEventV1

## What Exists

### Spark Bridge (created but needs wiring)
```
lib/spark-bridge.ts
```

Two functions ready to use:
- `emitMessage(channelId, role, content, agentId)` — for chat messages
- `emitDecision(actionType, result, context)` — for Makima pulse actions

### Channel Message Flow
```
User sends message in channel
  → app/api/chat/channel-reply/route.ts (SSE streaming)
  → Saves to chat_channel_messages table
  → Makima responds (streaming)
  → Response saved to chat_channel_messages
```

### Where to Wire

**File:** `app/api/chat/channel-reply/route.ts`

After saving user message and after saving Makima's response, call:
```typescript
import { emitMessage } from '@/lib/spark-bridge'

// After saving user message
emitMessage(channelId, 'user', content).catch(() => {})

// After saving Makima's response
emitMessage(channelId, 'assistant', fullResponse, 'makima').catch(() => {})
```

### SparkEventV1 Format
```json
{
  "v": 1,
  "source": "war-room",
  "kind": "message",
  "ts": 1740578400,
  "session_id": "channel-<uuid>",
  "payload": {
    "role": "user|assistant",
    "content": "message text",
    "agent_id": "makima"
  }
}
```

## Reference: Discord Spark Bridge

The Discord bot (Pip/Makima) already bridges to Spark:
- **Repo:** `~/clawd` branch `spark-bridge`
- **Commit:** `fafdf05975`
- **Plugin:** `extensions/spark-bridge/index.ts`
- Hooks `message_received` and `message_sent` events
- POSTs to `localhost:8787/ingest`

## Files to Touch

| File | Action |
|------|--------|
| `app/api/chat/channel-reply/route.ts` | Add emitMessage calls |
| `lib/spark-bridge.ts` | Already done, just import it |

## Verification

After wiring:
1. Send message in a channel
2. Check sparkd logs or `~/.spark/` for ingested events
3. Verify both user and assistant messages appear

## Questions?

- Spark daemon running? `curl localhost:8787/health`
- Event format issues? Check `lib/spark-bridge.ts` for SparkEventV1 interface
