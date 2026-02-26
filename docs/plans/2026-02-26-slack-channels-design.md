# Slack-Style Channels Design

## Experience Outcome

When I open Shoin Chat, I see organized channels grouped by category (like Slack). I can have focused topic discussions in channels while keeping DMs separate. When someone says something important, I can reply inline (quick context), forward it to another channel, or spin up a sidebar thread for deeper discussion.

---

## Context

**Problem:** Current Shoin Chat is DM-only with Makima. No way to organize conversations by topic or create persistent discussion spaces.

**Why Now:** As War Room grows, need topical organization. Agents may create channels. User wants Slack-style UX (preferred over Discord).

**Technical Outcome:** Additive schema—keep existing `chat_threads` for DMs, add `chat_categories`, `chat_channels`, and `chat_channel_messages` alongside.

---

## Design Decisions

### Three Distinct Message Actions

| Action | UX | Data |
|--------|----|----|
| **Reply** | Inline, shows quoted message above | `reply_to_id` on message |
| **Forward** | Copy to another channel with "Forwarded from" badge | `forwarded_from` (original msg ID) |
| **Thread** | Opens in sidebar panel, creates thread conversation | `thread_id` links replies to parent |

### Channel Model

- Channels live in categories (collapsible groups)
- Categories are manual (Makima + user can create)
- Channels can be created by agents or manually
- `#general` created by default

### Thread Model (Slack-style)

- Clicking "Thread" on a message opens sidebar
- Thread replies are separate from inline replies
- Thread count badge on parent message
- Thread panel shows parent + all thread replies

---

## Data Model

```sql
-- Categories (manual groupings)
CREATE TABLE chat_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INT DEFAULT 0,
  collapsed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Channels (topic spaces)
CREATE TABLE chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES chat_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,          -- "general", "research", etc.
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by TEXT,             -- "makima", "user", agent_id
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Channel messages (with reply/thread/forward support)
CREATE TABLE chat_channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  role TEXT NOT NULL,          -- "user", "assistant", "system"
  content TEXT NOT NULL,
  agent_id TEXT,               -- which agent sent it

  -- Reply (inline)
  reply_to_id UUID REFERENCES chat_channel_messages(id),

  -- Thread (sidebar)
  thread_id UUID REFERENCES chat_channel_messages(id),  -- parent message
  thread_count INT DEFAULT 0,  -- denormalized for badge

  -- Forward
  forwarded_from UUID REFERENCES chat_channel_messages(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_channel_messages_channel ON chat_channel_messages(channel_id);
CREATE INDEX idx_channel_messages_thread ON chat_channel_messages(thread_id);
```

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (240px)           │  Main Area        │  Thread   │
├────────────────────────────┼───────────────────┼───────────┤
│  ▼ DIRECT MESSAGES         │                   │  (opens   │
│    🟢 Makima               │  #general         │   when    │
│                            │                   │   thread  │
│  ▼ OPERATIONS              │  [messages...]    │   clicked)│
│    # general               │                   │           │
│    # alerts                │  ┌─────────────┐  │  Parent   │
│                            │  │ Msg actions │  │  msg      │
│  ▼ RESEARCH                │  │ ↩ 📤 💬    │  │           │
│    # papers                │  └─────────────┘  │  Thread   │
│    # ideas                 │                   │  replies  │
│                            │  [input...]       │           │
└────────────────────────────┴───────────────────┴───────────┘

Message actions: ↩ Reply | 📤 Forward | 💬 Thread
```

---

## Migration Strategy

1. **Additive only** — no changes to existing `chat_threads` / `chat_messages`
2. DMs continue to work as-is
3. Sidebar shows both DMs section and Channels section
4. Default `#general` channel created on first load

---

## Out of Scope

- Channel permissions/private channels (defer until multi-user)
- Message reactions/emoji (defer)
- Channel search (defer)
- Unread per-channel (use existing pattern from DMs)
- Voice/video (not planned)

---

## Verification

```bash
npm run build
```

1. Create category → appears in sidebar
2. Create channel in category → appears nested
3. Send message in channel → persists
4. Reply to message → shows inline with quote
5. Forward message → appears in target channel with badge
6. Start thread → sidebar opens, replies scoped to thread
