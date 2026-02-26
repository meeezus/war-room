"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { UnifiedSidebar } from '@/components/chat/unified-sidebar'
import { ChannelMessage } from '@/components/chat/channel-message'
import { ThreadPanel } from '@/components/chat/thread-panel'
import { ForwardModal } from '@/components/chat/forward-modal'
import { ChatInput } from '@/components/chat/chat-input'
import type { Category, Channel } from '@/components/chat/channel-sidebar'
import type { ThreadSummary } from '@/components/chat/thread-list'
import type { ChannelMessage as ChannelMessageType } from '@/lib/channels'
import { ArrowLeft, Hash, X } from 'lucide-react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  // Sidebar state
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [threads] = useState<ThreadSummary[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [activeThreadId] = useState<string | null>(null)

  // Messages
  const [messages, setMessages] = useState<ChannelMessageType[]>([])
  const [replyingTo, setReplyingTo] = useState<ChannelMessageType | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Thread panel
  const [threadParent, setThreadParent] = useState<ChannelMessageType | null>(null)
  const [threadReplies, setThreadReplies] = useState<ChannelMessageType[]>([])

  // Forward modal
  const [forwardingMessage, setForwardingMessage] = useState<ChannelMessageType | null>(null)

  // Ref for auto-scrolling messages
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Fetch categories + channels on mount, select default channel
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/channels')
        const data = await res.json()
        if (data.categories) {
          setCategories(
            data.categories.map((c: Category & { collapsed?: boolean }) => ({
              ...c,
              collapsed: c.collapsed ?? false,
            }))
          )
        }
        if (data.channels) {
          setChannels(data.channels)
          // Auto-select default channel, or first available
          const defaultCh = data.channels.find((ch: Channel) => ch.is_default)
          const target = defaultCh || data.channels[0]
          if (target) {
            setActiveChannelId(target.id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch channels:', err)
      }
    }
    load()
  }, [])

  // Fetch messages when activeChannelId changes
  useEffect(() => {
    if (!activeChannelId) return
    async function loadMessages() {
      try {
        const res = await fetch(`/api/channels/${activeChannelId}/messages`)
        const data = await res.json()
        if (Array.isArray(data)) {
          setMessages(data)
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err)
      }
    }
    loadMessages()
  }, [activeChannelId])

  // Fetch thread replies when threadParent changes
  useEffect(() => {
    if (!threadParent || !activeChannelId) {
      setThreadReplies([])
      return
    }
    async function loadThread() {
      try {
        const res = await fetch(
          `/api/channels/${activeChannelId}/messages?threadId=${threadParent!.id}`
        )
        const data = await res.json()
        if (Array.isArray(data)) {
          setThreadReplies(data)
        }
      } catch (err) {
        console.error('Failed to fetch thread replies:', err)
      }
    }
    loadThread()
  }, [threadParent, activeChannelId])

  // Auto-scroll on new messages
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSend = useCallback(
    async (content: string) => {
      if (!activeChannelId || isLoading) return
      setIsLoading(true)

      // Optimistic user message
      const optimistic: ChannelMessageType = {
        id: `temp-${Date.now()}`,
        channel_id: activeChannelId,
        role: 'user',
        content,
        agent_id: null,
        reply_to_id: replyingTo?.id ?? null,
        thread_id: null,
        thread_count: 0,
        forwarded_from: null,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimistic])
      setReplyingTo(null)

      try {
        const res = await fetch(`/api/channels/${activeChannelId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'user',
            content,
            replyToId: replyingTo?.id ?? undefined,
          }),
        })
        const saved = await res.json()
        // Replace optimistic with real
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? saved : m))
        )
      } catch (err) {
        console.error('Failed to send message:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [activeChannelId, isLoading, replyingTo]
  )

  const handleThreadReply = useCallback(
    async (content: string) => {
      if (!activeChannelId || !threadParent) return

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
        const saved = await res.json()
        setThreadReplies((prev) => [...prev, saved])

        // Update thread_count on parent in messages list
        setMessages((prev) =>
          prev.map((m) =>
            m.id === threadParent.id
              ? { ...m, thread_count: m.thread_count + 1 }
              : m
          )
        )
      } catch (err) {
        console.error('Failed to send thread reply:', err)
      }
    },
    [activeChannelId, threadParent]
  )

  const handleForward = useCallback(
    async (targetChannelId: string) => {
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
      } catch (err) {
        console.error('Failed to forward message:', err)
      } finally {
        setForwardingMessage(null)
      }
    },
    [forwardingMessage]
  )

  const handleCreateChannel = useCallback(
    async (categoryId: string | null) => {
      const name = window.prompt('Channel name:')
      if (!name?.trim()) return

      try {
        const res = await fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'channel', name: name.trim(), categoryId }),
        })
        const channel = await res.json()
        setChannels((prev) => [...prev, channel])
      } catch (err) {
        console.error('Failed to create channel:', err)
      }
    },
    []
  )

  const handleCreateCategory = useCallback(async () => {
    const name = window.prompt('Category name:')
    if (!name?.trim()) return

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'category', name: name.trim() }),
      })
      const category = await res.json()
      setCategories((prev) => [...prev, { ...category, collapsed: false }])
    } catch (err) {
      console.error('Failed to create category:', err)
    }
  }, [])

  const handleToggleCategory = useCallback((id: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === id ? { ...cat, collapsed: !cat.collapsed } : cat
      )
    )
  }, [])

  const handleReply = useCallback((message: ChannelMessageType) => {
    setReplyingTo(message)
  }, [])

  const handleThread = useCallback((message: ChannelMessageType) => {
    setThreadParent(message)
  }, [])

  const handleForwardAction = useCallback((message: ChannelMessageType) => {
    setForwardingMessage(message)
  }, [])

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const activeChannel = channels.find((ch) => ch.id === activeChannelId)

  // Build a lookup for reply-to messages
  const messagesById = new Map(messages.map((m) => [m.id, m]))

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0 border-r border-border bg-background overflow-hidden">
        <UnifiedSidebar
          // DM props (pass empty/noop since this is channels page)
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={() => {}}
          onNewThread={() => {}}
          // Channel props
          categories={categories}
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={(id) => {
            setActiveChannelId(id)
            setThreadParent(null)
            setReplyingTo(null)
          }}
          onCreateChannel={handleCreateChannel}
          onCreateCategory={handleCreateCategory}
          onToggleCategory={handleToggleCategory}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>

          {activeChannel ? (
            <div className="flex items-center gap-1.5">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium">
                {activeChannel.name}
              </span>
            </div>
          ) : (
            <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-muted-foreground">
              Channels
            </span>
          )}
        </div>

        {activeChannelId ? (
          <>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center h-full">
                  <p className="text-muted-foreground text-sm">
                    No messages yet. Start the conversation.
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {messages.map((msg) => (
                    <ChannelMessage
                      key={msg.id}
                      message={msg}
                      onReply={handleReply}
                      onForward={handleForwardAction}
                      onThread={handleThread}
                      replyToMessage={
                        msg.reply_to_id
                          ? messagesById.get(msg.reply_to_id) ?? null
                          : null
                      }
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Reply indicator */}
            {replyingTo && (
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Replying to{' '}
                  <span className="font-medium text-foreground">
                    {replyingTo.agent_id ?? replyingTo.role}
                  </span>
                </span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="ml-auto p-0.5 rounded hover:bg-muted"
                  aria-label="Cancel reply"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Chat input */}
            <ChatInput
              threadId={activeChannelId}
              onSend={handleSend}
              isLoading={isLoading}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Hash className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Select a channel to start chatting
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Thread panel (conditional) */}
      {threadParent && (
        <ThreadPanel
          parentMessage={threadParent}
          replies={threadReplies}
          onClose={() => setThreadParent(null)}
          onSendReply={handleThreadReply}
        />
      )}

      {/* Forward modal (conditional) */}
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
