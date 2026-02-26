# Slack-Style Channels Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Slack-style channels with categories, inline replies, forwards, and sidebar threads to Shoin Chat.

**Architecture:** Additive schema alongside existing DMs. New tables for categories, channels, and channel messages. Sidebar splits into DMs section + Channels section. Thread panel opens on right when thread action clicked.

**Tech Stack:** Next.js 14, Supabase (Postgres + Realtime), Tailwind, shadcn/ui patterns

---

## Sprint 1: Database Schema + API (Foundation)

### Task 1: Create Migration

**Files:**
- Create: `supabase/migrations/20260226100000_chat_channels.sql`

**Step 1: Write migration SQL**

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
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by TEXT,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Channel messages
CREATE TABLE chat_channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  agent_id TEXT,
  reply_to_id UUID REFERENCES chat_channel_messages(id),
  thread_id UUID REFERENCES chat_channel_messages(id),
  thread_count INT DEFAULT 0,
  forwarded_from UUID REFERENCES chat_channel_messages(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_channel_messages_channel ON chat_channel_messages(channel_id);
CREATE INDEX idx_channel_messages_thread ON chat_channel_messages(thread_id);
CREATE INDEX idx_channels_category ON chat_channels(category_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channel_messages;

-- Seed default category and channel
INSERT INTO chat_categories (name, position) VALUES ('General', 0);
INSERT INTO chat_channels (category_id, name, is_default, created_by, position)
SELECT id, 'general', true, 'system', 0 FROM chat_categories WHERE name = 'General';
```

**Step 2: Run migration locally**

Run: `cd ~/Code/war-room && npx supabase db push`
Expected: Tables created, seeded with #general

**Step 3: Commit**

```bash
git add supabase/migrations/20260226100000_chat_channels.sql
git commit -m "feat: add chat_channels schema with categories and threads"
```

---

### Task 2: Create Channel Library Functions

**Files:**
- Create: `lib/channels.ts`

**Step 1: Write channel CRUD functions**

```typescript
import { createServiceClient } from '@/lib/supabase-server'

export interface ChatCategory {
  id: string
  name: string
  position: number
  collapsed: boolean
  created_at: string
}

export interface ChatChannel {
  id: string
  category_id: string | null
  name: string
  description: string | null
  is_default: boolean
  created_by: string | null
  position: number
  created_at: string
}

export interface ChannelMessage {
  id: string
  channel_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agent_id: string | null
  reply_to_id: string | null
  thread_id: string | null
  thread_count: number
  forwarded_from: string | null
  created_at: string
  // Joined data
  reply_to?: ChannelMessage | null
  forwarded_message?: ChannelMessage | null
}

function getServiceClientOrThrow() {
  const sb = createServiceClient()
  if (!sb) throw new Error('No Supabase connection')
  return sb
}

// Categories
export async function getCategories(): Promise<ChatCategory[]> {
  const sb = getServiceClientOrThrow()
  const { data, error } = await sb
    .from('chat_categories')
    .select('*')
    .order('position')
  if (error) throw error
  return data ?? []
}

export async function createCategory(name: string): Promise<ChatCategory> {
  const sb = getServiceClientOrThrow()
  const { data: maxPos } = await sb
    .from('chat_categories')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const { data, error } = await sb
    .from('chat_categories')
    .insert({ name, position: (maxPos?.position ?? -1) + 1 })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id: string, updates: Partial<Pick<ChatCategory, 'name' | 'collapsed' | 'position'>>): Promise<void> {
  const sb = getServiceClientOrThrow()
  const { error } = await sb
    .from('chat_categories')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id: string): Promise<void> {
  const sb = getServiceClientOrThrow()
  const { error } = await sb
    .from('chat_categories')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Channels
export async function getChannels(): Promise<ChatChannel[]> {
  const sb = getServiceClientOrThrow()
  const { data, error } = await sb
    .from('chat_channels')
    .select('*')
    .order('position')
  if (error) throw error
  return data ?? []
}

export async function getChannel(id: string): Promise<ChatChannel | null> {
  const sb = getServiceClientOrThrow()
  const { data, error } = await sb
    .from('chat_channels')
    .select('*')
    .eq('id', id)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function createChannel(
  name: string,
  categoryId: string | null,
  createdBy: string,
  description?: string
): Promise<ChatChannel> {
  const sb = getServiceClientOrThrow()
  const { data: maxPos } = await sb
    .from('chat_channels')
    .select('position')
    .eq('category_id', categoryId)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const { data, error } = await sb
    .from('chat_channels')
    .insert({
      name,
      category_id: categoryId,
      created_by: createdBy,
      description: description ?? null,
      position: (maxPos?.position ?? -1) + 1,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteChannel(id: string): Promise<void> {
  const sb = getServiceClientOrThrow()
  const { error } = await sb
    .from('chat_channels')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Channel Messages
export async function getChannelMessages(channelId: string, limit = 100): Promise<ChannelMessage[]> {
  const sb = getServiceClientOrThrow()
  const { data, error } = await sb
    .from('chat_channel_messages')
    .select('*')
    .eq('channel_id', channelId)
    .is('thread_id', null) // Only top-level messages
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getThreadMessages(threadId: string): Promise<ChannelMessage[]> {
  const sb = getServiceClientOrThrow()
  const { data, error } = await sb
    .from('chat_channel_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveChannelMessage(
  channelId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  options?: {
    agentId?: string
    replyToId?: string
    threadId?: string
    forwardedFrom?: string
  }
): Promise<ChannelMessage> {
  const sb = getServiceClientOrThrow()
  const { data, error } = await sb
    .from('chat_channel_messages')
    .insert({
      channel_id: channelId,
      role,
      content,
      agent_id: options?.agentId ?? null,
      reply_to_id: options?.replyToId ?? null,
      thread_id: options?.threadId ?? null,
      forwarded_from: options?.forwardedFrom ?? null,
    })
    .select()
    .single()
  if (error) throw error

  // If this is a thread reply, increment parent's thread_count
  if (options?.threadId) {
    await sb.rpc('increment_thread_count', { message_id: options.threadId })
  }

  return data
}

export async function forwardMessage(
  messageId: string,
  targetChannelId: string
): Promise<ChannelMessage> {
  const sb = getServiceClientOrThrow()

  // Get original message
  const { data: original, error: fetchErr } = await sb
    .from('chat_channel_messages')
    .select('*')
    .eq('id', messageId)
    .single()
  if (fetchErr) throw fetchErr

  // Create forwarded copy
  return saveChannelMessage(
    targetChannelId,
    original.role,
    original.content,
    {
      agentId: original.agent_id,
      forwardedFrom: messageId,
    }
  )
}
```

**Step 2: Add RPC for thread count increment**

Add to migration or create new one:

```sql
-- Add to 20260226100000_chat_channels.sql before commit
CREATE OR REPLACE FUNCTION increment_thread_count(message_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE chat_channel_messages
  SET thread_count = thread_count + 1
  WHERE id = message_id;
END;
$$ LANGUAGE plpgsql;
```

**Step 3: Verify types compile**

Run: `cd ~/Code/war-room && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/channels.ts supabase/migrations/20260226100000_chat_channels.sql
git commit -m "feat: add channel library functions"
```

---

### Task 3: Create Channel API Routes

**Files:**
- Create: `app/api/channels/route.ts`
- Create: `app/api/channels/[id]/route.ts`
- Create: `app/api/channels/[id]/messages/route.ts`

**Step 1: Write channels list/create endpoint**

```typescript
// app/api/channels/route.ts
import { NextResponse } from 'next/server'
import { getCategories, getChannels, createCategory, createChannel } from '@/lib/channels'

export async function GET() {
  try {
    const [categories, channels] = await Promise.all([
      getCategories(),
      getChannels(),
    ])
    return NextResponse.json({ categories, channels })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (body.type === 'category') {
      const category = await createCategory(body.name)
      return NextResponse.json(category)
    }

    if (body.type === 'channel') {
      const channel = await createChannel(
        body.name,
        body.categoryId ?? null,
        body.createdBy ?? 'user',
        body.description
      )
      return NextResponse.json(channel)
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

**Step 2: Write single channel endpoint**

```typescript
// app/api/channels/[id]/route.ts
import { NextResponse } from 'next/server'
import { getChannel, deleteChannel } from '@/lib/channels'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const channel = await getChannel(id)
    if (!channel) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(channel)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteChannel(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

**Step 3: Write channel messages endpoint**

```typescript
// app/api/channels/[id]/messages/route.ts
import { NextResponse } from 'next/server'
import { getChannelMessages, saveChannelMessage, forwardMessage } from '@/lib/channels'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const messages = await getChannelMessages(id)
    return NextResponse.json(messages)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    // Forward action
    if (body.action === 'forward') {
      const forwarded = await forwardMessage(body.messageId, id)
      return NextResponse.json(forwarded)
    }

    // Normal message
    const message = await saveChannelMessage(id, body.role, body.content, {
      agentId: body.agentId,
      replyToId: body.replyToId,
      threadId: body.threadId,
    })
    return NextResponse.json(message)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

**Step 4: Verify build**

Run: `cd ~/Code/war-room && npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add app/api/channels/
git commit -m "feat: add channel API routes"
```

---

## Sprint 2: Sidebar UI (Channel List)

### Task 4: Create Channel Sidebar Component

**Files:**
- Create: `components/chat/channel-sidebar.tsx`

**Step 1: Write the component**

```typescript
"use client"

import { useState } from 'react'
import { ChevronDown, ChevronRight, Hash, Plus, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Category {
  id: string
  name: string
  collapsed: boolean
}

export interface Channel {
  id: string
  category_id: string | null
  name: string
  is_default: boolean
}

interface ChannelSidebarProps {
  categories: Category[]
  channels: Channel[]
  activeChannelId: string | null
  onSelectChannel: (id: string) => void
  onCreateChannel?: (categoryId: string | null) => void
  onCreateCategory?: () => void
  onToggleCategory?: (id: string) => void
}

export function ChannelSidebar({
  categories,
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onCreateCategory,
  onToggleCategory,
}: ChannelSidebarProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)

  const channelsByCategory = channels.reduce((acc, ch) => {
    const catId = ch.category_id ?? 'uncategorized'
    if (!acc[catId]) acc[catId] = []
    acc[catId].push(ch)
    return acc
  }, {} as Record<string, Channel[]>)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-foreground">
          Channels
        </h2>
        {onCreateCategory && (
          <button
            onClick={onCreateCategory}
            className="h-7 w-7 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
            title="Add category"
          >
            <Plus className="h-3.5 w-3.5 text-foreground/80" />
          </button>
        )}
      </div>

      {/* Categories + Channels */}
      <div className="flex-1 overflow-y-auto py-2">
        {categories.map((category) => (
          <div key={category.id}>
            {/* Category header */}
            <div
              className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-muted/50"
              onMouseEnter={() => setHoveredCategory(category.id)}
              onMouseLeave={() => setHoveredCategory(null)}
              onClick={() => onToggleCategory?.(category.id)}
            >
              {category.collapsed ? (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex-1">
                {category.name}
              </span>
              {hoveredCategory === category.id && onCreateChannel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateChannel(category.id)
                  }}
                  className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted"
                >
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Channels in category */}
            {!category.collapsed && (
              <div className="ml-2">
                {(channelsByCategory[category.id] ?? []).map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => onSelectChannel(channel.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors',
                      activeChannelId === channel.id
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-foreground/70 hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <Hash className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{channel.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Uncategorized channels */}
        {(channelsByCategory['uncategorized'] ?? []).length > 0 && (
          <div className="mt-2">
            {channelsByCategory['uncategorized'].map((channel) => (
              <button
                key={channel.id}
                onClick={() => onSelectChannel(channel.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors',
                  activeChannelId === channel.id
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-foreground/70 hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Hash className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm truncate">{channel.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify types compile**

Run: `cd ~/Code/war-room && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/chat/channel-sidebar.tsx
git commit -m "feat: add channel sidebar component"
```

---

### Task 5: Create Combined Sidebar (DMs + Channels)

**Files:**
- Create: `components/chat/unified-sidebar.tsx`

**Step 1: Write unified sidebar that combines DMs and channels**

```typescript
"use client"

import { useState } from 'react'
import { ThreadList, ThreadSummary } from './thread-list'
import { ChannelSidebar, Category, Channel } from './channel-sidebar'

type ViewMode = 'dms' | 'channels'

interface UnifiedSidebarProps {
  // DM props
  threads: ThreadSummary[]
  activeThreadId: string | null
  onSelectThread: (id: string) => void
  onNewThread: () => void
  isCreatingThread?: boolean
  onArchiveThread?: (id: string) => void
  onDeleteThread?: (id: string) => void
  onRenameThread?: (id: string, title: string) => void
  showArchived?: boolean
  onToggleArchived?: () => void
  agentStatuses?: Record<string, string>

  // Channel props
  categories: Category[]
  channels: Channel[]
  activeChannelId: string | null
  onSelectChannel: (id: string) => void
  onCreateChannel?: (categoryId: string | null) => void
  onCreateCategory?: () => void
  onToggleCategory?: (id: string) => void
}

export function UnifiedSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  isCreatingThread,
  onArchiveThread,
  onDeleteThread,
  onRenameThread,
  showArchived,
  onToggleArchived,
  agentStatuses,
  categories,
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onCreateCategory,
  onToggleCategory,
}: UnifiedSidebarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('dms')

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* View mode tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setViewMode('dms')}
          className={`flex-1 py-3 text-xs font-medium transition-colors ${
            viewMode === 'dms'
              ? 'text-emerald-400 border-b-2 border-emerald-500'
              : 'text-muted-foreground hover:text-foreground/80'
          }`}
        >
          Direct Messages
        </button>
        <button
          onClick={() => setViewMode('channels')}
          className={`flex-1 py-3 text-xs font-medium transition-colors ${
            viewMode === 'channels'
              ? 'text-emerald-400 border-b-2 border-emerald-500'
              : 'text-muted-foreground hover:text-foreground/80'
          }`}
        >
          Channels
        </button>
      </div>

      {/* Content based on mode */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'dms' ? (
          <ThreadList
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={onSelectThread}
            onNewThread={onNewThread}
            isCreating={isCreatingThread}
            onArchive={onArchiveThread}
            onDelete={onDeleteThread}
            onRename={onRenameThread}
            showArchived={showArchived}
            onToggleArchived={onToggleArchived}
            agentStatuses={agentStatuses}
          />
        ) : (
          <ChannelSidebar
            categories={categories}
            channels={channels}
            activeChannelId={activeChannelId}
            onSelectChannel={onSelectChannel}
            onCreateChannel={onCreateChannel}
            onCreateCategory={onCreateCategory}
            onToggleCategory={onToggleCategory}
          />
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify types compile**

Run: `cd ~/Code/war-room && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/chat/unified-sidebar.tsx
git commit -m "feat: add unified sidebar with DMs and channels tabs"
```

---

## Sprint 3: Channel Message Area

### Task 6: Create Channel Message Components

**Files:**
- Create: `components/chat/channel-message.tsx`

**Step 1: Write channel message bubble with actions**

```typescript
"use client"

import { useState } from 'react'
import { Reply, Forward, MessageSquare, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChannelMessage } from '@/lib/channels'

interface ChannelMessageProps {
  message: ChannelMessage
  onReply?: (message: ChannelMessage) => void
  onForward?: (message: ChannelMessage) => void
  onThread?: (message: ChannelMessage) => void
  replyToMessage?: ChannelMessage | null
  forwardedFromMessage?: ChannelMessage | null
}

export function ChannelMessageBubble({
  message,
  onReply,
  onForward,
  onThread,
  replyToMessage,
  forwardedFromMessage,
}: ChannelMessageProps) {
  const [showActions, setShowActions] = useState(false)
  const isUser = message.role === 'user'

  return (
    <div
      className="group relative px-4 py-2 hover:bg-muted/30"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Forwarded indicator */}
      {forwardedFromMessage && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 ml-10">
          <Forward className="h-3 w-3" />
          <span>Forwarded message</span>
        </div>
      )}

      {/* Reply context */}
      {replyToMessage && (
        <div className="flex items-center gap-2 ml-10 mb-1 pl-2 border-l-2 border-muted-foreground/30">
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {replyToMessage.content}
          </span>
        </div>
      )}

      {/* Message content */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          {message.agent_id ? (
            <img
              src={`/avatars/${message.agent_id}.webp`}
              alt={message.agent_id}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <span className="text-xs font-medium text-foreground">
              {isUser ? 'U' : 'A'}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {message.agent_id ?? (isUser ? 'You' : 'Assistant')}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
            {message.content}
          </p>

          {/* Thread count badge */}
          {message.thread_count > 0 && (
            <button
              onClick={() => onThread?.(message)}
              className="mt-1 flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
            >
              <MessageSquare className="h-3 w-3" />
              <span>{message.thread_count} {message.thread_count === 1 ? 'reply' : 'replies'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Hover actions */}
      {showActions && (
        <div className="absolute right-4 top-1 flex items-center gap-1 bg-background border border-border rounded-md shadow-sm">
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="p-1.5 hover:bg-muted rounded"
              title="Reply"
            >
              <Reply className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          {onForward && (
            <button
              onClick={() => onForward(message)}
              className="p-1.5 hover:bg-muted rounded"
              title="Forward"
            >
              <Forward className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          {onThread && (
            <button
              onClick={() => onThread(message)}
              className="p-1.5 hover:bg-muted rounded"
              title="Start thread"
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify types compile**

Run: `cd ~/Code/war-room && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/chat/channel-message.tsx
git commit -m "feat: add channel message bubble with reply/forward/thread actions"
```

---

### Task 7: Create Thread Panel Component

**Files:**
- Create: `components/chat/thread-panel.tsx`

**Step 1: Write thread sidebar panel**

```typescript
"use client"

import { useEffect, useRef, useState } from 'react'
import { X, Send } from 'lucide-react'
import { ChannelMessageBubble } from './channel-message'
import type { ChannelMessage } from '@/lib/channels'

interface ThreadPanelProps {
  parentMessage: ChannelMessage
  replies: ChannelMessage[]
  onClose: () => void
  onSendReply: (content: string) => void
  isLoading?: boolean
}

export function ThreadPanel({
  parentMessage,
  replies,
  onClose,
  onSendReply,
  isLoading,
}: ThreadPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    onSendReply(input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full w-80 border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium">
          Thread
        </h3>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Parent message */}
      <div className="border-b border-border">
        <ChannelMessageBubble message={parentMessage} />
      </div>

      {/* Thread replies */}
      <div className="flex-1 overflow-y-auto">
        <div className="text-xs text-muted-foreground px-4 py-2">
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </div>
        {replies.map((reply) => (
          <ChannelMessageBubble key={reply.id} message={reply} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Reply in thread..."
            className="flex-1 bg-muted rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-9 w-9 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </form>
    </div>
  )
}
```

**Step 2: Verify types compile**

Run: `cd ~/Code/war-room && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/chat/thread-panel.tsx
git commit -m "feat: add thread panel component"
```

---

### Task 8: Create Forward Modal Component

**Files:**
- Create: `components/chat/forward-modal.tsx`

**Step 1: Write forward channel selector modal**

```typescript
"use client"

import { useState } from 'react'
import { X, Hash, Search } from 'lucide-react'
import type { Channel } from './channel-sidebar'

interface ForwardModalProps {
  channels: Channel[]
  currentChannelId: string
  onForward: (targetChannelId: string) => void
  onClose: () => void
}

export function ForwardModal({
  channels,
  currentChannelId,
  onForward,
  onClose,
}: ForwardModalProps) {
  const [search, setSearch] = useState('')

  const filteredChannels = channels.filter(
    (ch) =>
      ch.id !== currentChannelId &&
      ch.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm bg-background border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium">
            Forward to channel
          </h3>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels..."
              className="w-full bg-muted rounded-md pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoFocus
            />
          </div>
        </div>

        {/* Channel list */}
        <div className="max-h-60 overflow-y-auto p-2">
          {filteredChannels.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No channels found
            </p>
          ) : (
            filteredChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => onForward(channel.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-left"
              >
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{channel.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify types compile**

Run: `cd ~/Code/war-room && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/chat/forward-modal.tsx
git commit -m "feat: add forward modal component"
```

---

## Sprint 4: Integration + Channel Page

### Task 9: Create Channel View Page

**Files:**
- Create: `app/channels/page.tsx`

**Step 1: Write the channel view page**

```typescript
"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import { UnifiedSidebar } from '@/components/chat/unified-sidebar'
import { ChannelMessageBubble } from '@/components/chat/channel-message'
import { ThreadPanel } from '@/components/chat/thread-panel'
import { ForwardModal } from '@/components/chat/forward-modal'
import { ChatInput } from '@/components/chat/chat-input'
import type { Category, Channel } from '@/components/chat/channel-sidebar'
import type { ThreadSummary } from '@/components/chat/thread-list'
import type { ChannelMessage } from '@/lib/channels'

export default function ChannelsPage() {
  // Sidebar state
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  // Messages state
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [replyingTo, setReplyingTo] = useState<ChannelMessage | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Thread panel state
  const [threadParent, setThreadParent] = useState<ChannelMessage | null>(null)
  const [threadReplies, setThreadReplies] = useState<ChannelMessage[]>([])

  // Forward modal state
  const [forwardingMessage, setForwardingMessage] = useState<ChannelMessage | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch categories and channels
  useEffect(() => {
    async function fetchChannels() {
      const res = await fetch('/api/channels')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories)
        setChannels(data.channels)
        // Select default channel
        const defaultChannel = data.channels.find((c: Channel) => c.is_default)
        if (defaultChannel) {
          setActiveChannelId(defaultChannel.id)
        }
      }
    }
    fetchChannels()
  }, [])

  // Fetch messages when channel changes
  useEffect(() => {
    if (!activeChannelId) return
    async function fetchMessages() {
      const res = await fetch(`/api/channels/${activeChannelId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    }
    fetchMessages()
  }, [activeChannelId])

  // Fetch thread replies when thread opens
  useEffect(() => {
    if (!threadParent) {
      setThreadReplies([])
      return
    }
    async function fetchThread() {
      const res = await fetch(`/api/channels/${activeChannelId}/messages?threadId=${threadParent.id}`)
      if (res.ok) {
        const data = await res.json()
        setThreadReplies(data)
      }
    }
    fetchThread()
  }, [threadParent, activeChannelId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const handleSend = useCallback(async (content: string) => {
    if (!activeChannelId || !content.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/channels/${activeChannelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content,
          replyToId: replyingTo?.id,
        }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages((prev) => [...prev, msg])
        setReplyingTo(null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [activeChannelId, replyingTo])

  // Send thread reply
  const handleThreadReply = useCallback(async (content: string) => {
    if (!activeChannelId || !threadParent || !content.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/channels/${activeChannelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content,
          threadId: threadParent.id,
        }),
      })
      if (res.ok) {
        const msg = await res.json()
        setThreadReplies((prev) => [...prev, msg])
        // Update parent thread count
        setMessages((prev) =>
          prev.map((m) =>
            m.id === threadParent.id
              ? { ...m, thread_count: m.thread_count + 1 }
              : m
          )
        )
      }
    } finally {
      setIsLoading(false)
    }
  }, [activeChannelId, threadParent])

  // Forward message
  const handleForward = useCallback(async (targetChannelId: string) => {
    if (!forwardingMessage) return
    try {
      await fetch(`/api/channels/${targetChannelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'forward',
          messageId: forwardingMessage.id,
        }),
      })
      setForwardingMessage(null)
    } catch (err) {
      console.error('Forward failed:', err)
    }
  }, [forwardingMessage])

  // Create channel
  const handleCreateChannel = useCallback(async (categoryId: string | null) => {
    const name = prompt('Channel name:')
    if (!name) return
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'channel', name, categoryId, createdBy: 'user' }),
    })
    if (res.ok) {
      const channel = await res.json()
      setChannels((prev) => [...prev, channel])
    }
  }, [])

  // Create category
  const handleCreateCategory = useCallback(async () => {
    const name = prompt('Category name:')
    if (!name) return
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', name }),
    })
    if (res.ok) {
      const category = await res.json()
      setCategories((prev) => [...prev, category])
    }
  }, [])

  // Toggle category collapse
  const handleToggleCategory = useCallback((id: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, collapsed: !c.collapsed } : c))
    )
  }, [])

  const activeChannel = channels.find((c) => c.id === activeChannelId)

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0">
        <UnifiedSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          onNewThread={() => {}}
          categories={categories}
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={setActiveChannelId}
          onCreateChannel={handleCreateChannel}
          onCreateCategory={handleCreateCategory}
          onToggleCategory={handleToggleCategory}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        {activeChannel && (
          <div className="h-14 border-b border-border flex items-center px-4">
            <span className="text-lg font-medium">#{activeChannel.name}</span>
            {activeChannel.description && (
              <span className="ml-3 text-sm text-muted-foreground">
                {activeChannel.description}
              </span>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.map((msg) => (
            <ChannelMessageBubble
              key={msg.id}
              message={msg}
              onReply={setReplyingTo}
              onForward={setForwardingMessage}
              onThread={setThreadParent}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply indicator */}
        {replyingTo && (
          <div className="px-4 py-2 border-t border-border bg-muted/50 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Replying to: {replyingTo.content.slice(0, 50)}...
            </span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading || !activeChannelId}
            placeholder={activeChannel ? `Message #${activeChannel.name}` : 'Select a channel'}
          />
        </div>
      </div>

      {/* Thread panel */}
      {threadParent && (
        <ThreadPanel
          parentMessage={threadParent}
          replies={threadReplies}
          onClose={() => setThreadParent(null)}
          onSendReply={handleThreadReply}
          isLoading={isLoading}
        />
      )}

      {/* Forward modal */}
      {forwardingMessage && activeChannelId && (
        <ForwardModal
          channels={channels}
          currentChannelId={activeChannelId}
          onForward={handleForward}
          onClose={() => setForwardingMessage(null)}
        />
      )}
    </div>
  )
}
```

**Step 2: Verify build**

Run: `cd ~/Code/war-room && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add app/channels/page.tsx
git commit -m "feat: add channels page with full UI integration"
```

---

### Task 10: Add Thread Messages API Endpoint

**Files:**
- Modify: `app/api/channels/[id]/messages/route.ts`

**Step 1: Update GET to support threadId query param**

Update the GET handler to fetch thread replies when `threadId` is provided:

```typescript
// In app/api/channels/[id]/messages/route.ts - update GET handler
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const threadId = searchParams.get('threadId')

    if (threadId) {
      // Fetch thread replies
      const { getThreadMessages } = await import('@/lib/channels')
      const messages = await getThreadMessages(threadId)
      return NextResponse.json(messages)
    }

    const messages = await getChannelMessages(id)
    return NextResponse.json(messages)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

**Step 2: Verify build**

Run: `cd ~/Code/war-room && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add app/api/channels/[id]/messages/route.ts
git commit -m "feat: add thread messages query support"
```

---

## Final Verification

Run: `cd ~/Code/war-room && npm run build`
Expected: Build succeeds with no errors

Manual verification checklist:
1. `/channels` page loads with sidebar
2. Categories collapse/expand
3. Channels appear under categories
4. Create category via + button
5. Create channel via + on category hover
6. Send message in channel
7. Reply action shows quote indicator
8. Forward action opens modal, message appears in target
9. Thread action opens sidebar, replies scoped to thread

---

## Rollback

```bash
# Remove migration
DROP TABLE chat_channel_messages;
DROP TABLE chat_channels;
DROP TABLE chat_categories;
DROP FUNCTION increment_thread_count;

# Git revert
git revert HEAD~10..HEAD  # Adjust range as needed
```
