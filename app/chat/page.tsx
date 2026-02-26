"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRealtimeChannel } from '@/lib/use-realtime-channel'
import { UnifiedSidebar } from '@/components/chat/unified-sidebar'
import type { ThreadSummary } from '@/components/chat/thread-list'
import type { Category, Channel } from '@/components/chat/channel-sidebar'
import { MessageArea } from '@/components/chat/message-area'
import { ChannelMessage as ChannelMessageBubble } from '@/components/chat/channel-message'
import { ChatInput } from '@/components/chat/chat-input'
import { AgentSelector } from '@/components/chat/agent-selector'
import { ChatActions } from '@/components/chat/chat-actions'
import { ThreadPanel } from '@/components/chat/thread-panel'
import { ForwardModal } from '@/components/chat/forward-modal'
import { supabase } from '@/lib/supabase'
import type { ChatMessage } from '@/lib/chat'
import type { ChannelMessage as ChannelMessageType } from '@/lib/channels'
import { ArrowLeft, ChevronLeft, Hash, Menu, X, Zap } from 'lucide-react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// View mode: either viewing a DM thread or a channel
// ---------------------------------------------------------------------------
type ViewContext =
  | { type: 'dm'; threadId: string }
  | { type: 'channel'; channelId: string }
  | null

export default function ChatPage() {
  // ---------------------------------------------------------------------------
  // DM state
  // ---------------------------------------------------------------------------
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingMessages, setIsFetchingMessages] = useState(false)
  const [isCreatingThread, setIsCreatingThread] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [agentSelectorOpen, setAgentSelectorOpen] = useState(false)
  // ---------------------------------------------------------------------------
  // Channel state
  // ---------------------------------------------------------------------------
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [channelMessages, setChannelMessages] = useState<ChannelMessageType[]>([])
  const [channelStreamingContent, setChannelStreamingContent] = useState('')
  const [isChannelLoading, setIsChannelLoading] = useState(false)
  const [channelError, setChannelError] = useState<string | null>(null)

  // Thread panel (for channel threads)
  const [threadParent, setThreadParent] = useState<ChannelMessageType | null>(null)
  const [threadReplies, setThreadReplies] = useState<ChannelMessageType[]>([])
  const [threadStreamingContent, setThreadStreamingContent] = useState('')
  const [isThreadLoading, setIsThreadLoading] = useState(false)
  const [isThreadTyping, setIsThreadTyping] = useState(false)

  // Forward modal
  const [forwardingMessage, setForwardingMessage] = useState<ChannelMessageType | null>(null)

  // Channel reply-to
  const [replyingTo, setReplyingTo] = useState<ChannelMessageType | null>(null)

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const viewContext: ViewContext = activeThreadId
    ? { type: 'dm', threadId: activeThreadId }
    : activeChannelId
      ? { type: 'channel', channelId: activeChannelId }
      : null

  const activeChannel = channels.find((ch) => ch.id === activeChannelId)
  const channelMessagesById = new Map(channelMessages.map((m) => [m.id, m]))

  // ---------------------------------------------------------------------------
  // Effects: DM threads
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchThreads()
  }, [])

  // Subscribe to Realtime for active thread messages
  useRealtimeChannel(
    activeThreadId ? `chat-messages-${activeThreadId}` : null,
    (ch) =>
      ch.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${activeThreadId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            const tempIdx = prev.findIndex(
              (m) => m.id.startsWith('temp-') && m.role === newMsg.role && m.content === newMsg.content
            )
            if (tempIdx !== -1) {
              const updated = [...prev]
              updated[tempIdx] = newMsg
              return updated
            }
            return [...prev, newMsg]
          })
        }
      ),
  )

  // Subscribe to thread list updates
  useRealtimeChannel(
    'chat-threads-updates',
    (ch) =>
      ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_threads' },
        () => {
          fetchThreads()
        }
      ),
  )

  // ---------------------------------------------------------------------------
  // Effects: Channels
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadChannels() {
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
        }
      } catch (err) {
        console.error('Failed to fetch channels:', err)
      }
    }
    loadChannels()
  }, [])

  // Fetch channel messages when activeChannelId changes
  useEffect(() => {
    if (!activeChannelId) return
    async function loadMessages() {
      try {
        const res = await fetch(`/api/channels/${activeChannelId}/messages`)
        const data = await res.json()
        if (Array.isArray(data)) {
          setChannelMessages(data)
        }
      } catch (err) {
        console.error('Failed to fetch channel messages:', err)
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

  // Auto-scroll channel messages
  useEffect(() => {
    if (viewContext?.type === 'channel' && typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [channelMessages.length, viewContext?.type])

  // ---------------------------------------------------------------------------
  // DM handlers
  // ---------------------------------------------------------------------------
  const fetchThreads = async (archived = showArchived) => {
    try {
      const status = archived ? 'archived' : 'active'
      const res = await fetch(`/api/chat/threads?status=${status}`)
      const data = await res.json()
      if (data.threads) {
        setThreads(data.threads)
        // Auto-select first thread if none selected and no channel is active
        if (!activeThreadId && !activeChannelId && data.threads.length > 0) {
          selectThread(data.threads[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch threads:', err)
    }
  }

  const handleArchiveThread = async (id: string) => {
    try {
      await fetch(`/api/chat/threads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
      fetchThreads()
    } catch (err) {
      console.error('Failed to archive thread:', err)
    }
  }

  const handleDeleteThread = async (id: string) => {
    try {
      await fetch(`/api/chat/threads/${id}`, { method: 'DELETE' })
      if (activeThreadId === id) {
        setActiveThreadId(null)
        setMessages([])
      }
      fetchThreads()
    } catch (err) {
      console.error('Failed to delete thread:', err)
    }
  }

  const handleRenameThread = async (id: string, title: string) => {
    try {
      await fetch(`/api/chat/threads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      fetchThreads()
    } catch (err) {
      console.error('Failed to rename thread:', err)
    }
  }

  const handleToggleArchived = () => {
    const next = !showArchived
    setShowArchived(next)
    fetchThreads(next)
  }

  const fetchMessages = async (threadId: string) => {
    if (!supabase) return
    setIsFetchingMessages(true)
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setMessages(data ?? [])
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    } finally {
      setIsFetchingMessages(false)
    }
  }

  const selectThread = (threadId: string) => {
    // Mutual exclusion: clear channel selection
    setActiveChannelId(null)
    setChannelMessages([])
    setChannelStreamingContent('')
    setChannelError(null)
    setThreadParent(null)
    setReplyingTo(null)

    setActiveThreadId(threadId)
    setMessages([])
    setStreamingContent('')
    setError(null)
    fetchMessages(threadId)
  }

  const selectChannel = (channelId: string) => {
    // Mutual exclusion: clear DM selection
    setActiveThreadId(null)
    setMessages([])
    setStreamingContent('')
    setError(null)

    setActiveChannelId(channelId)
    setChannelMessages([])
    setChannelStreamingContent('')
    setChannelError(null)
    setThreadParent(null)
    setReplyingTo(null)
  }

  const createThread = async (agentId?: string) => {
    setIsCreatingThread(true)
    // Use agent display name as thread title (Slack-style)
    const agentName = agentId === 'cc' ? 'Claude Code'
      : agentId === 'makima' ? 'Makima'
      : agentId ? agentId.charAt(0).toUpperCase() + agentId.slice(1)
      : 'Claude Code'
    try {
      const res = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: agentName, agentId: agentId || 'cc' }),
      })
      const data = await res.json()
      if (data.thread) {
        setThreads((prev) => [data.thread, ...prev])
        selectThread(data.thread.id)
      }
    } catch (err) {
      console.error('Failed to create thread:', err)
    } finally {
      setIsCreatingThread(false)
    }
  }

  // ---------------------------------------------------------------------------
  // DM send message (streaming)
  // ---------------------------------------------------------------------------
  const sendMessage = useCallback(async (content: string) => {
    if (!activeThreadId || isLoading) return

    setError(null)
    setIsLoading(true)
    setStreamingContent('')

    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      thread_id: activeThreadId,
      role: 'user',
      content,
      agent_id: null,
      user_id: 'sensei',
      streaming: false,
      streaming_complete: true,
      metadata: {},
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: activeThreadId, content }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let accumulated = ''
      let sseBuffer = ''
      let pendingFlush = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)
          if (!jsonStr.trim()) continue

          try {
            const event = JSON.parse(jsonStr)
            if (event.type === 'typing') {
              setIsTyping(true)
              continue
            } else if (event.type === 'chunk') {
              setIsTyping(false)
              accumulated += event.content
              if (!pendingFlush) {
                pendingFlush = true
                requestAnimationFrame(() => {
                  setStreamingContent(accumulated)
                  pendingFlush = false
                })
              }
            } else if (event.type === 'done') {
              pendingFlush = false
              const activeAgent = threads.find(t => t.id === activeThreadId)?.agent_id || 'cc'
              const assistantMsg: ChatMessage = {
                id: event.messageId || `done-${Date.now()}`,
                thread_id: activeThreadId!,
                role: 'assistant',
                content: accumulated,
                agent_id: event.agentId || activeAgent,
                user_id: null,
                streaming: false,
                streaming_complete: true,
                metadata: {},
                created_at: new Date().toISOString(),
              }
              setMessages((prev) => {
                if (prev.some((m) => m.id === assistantMsg.id)) return prev
                return [...prev, assistantMsg]
              })
              setStreamingContent('')
            } else if (event.type === 'error') {
              pendingFlush = false
              if (accumulated) {
                const activeAgentPartial = threads.find(t => t.id === activeThreadId)?.agent_id || 'cc'
                const partialMsg: ChatMessage = {
                  id: `partial-${Date.now()}`,
                  thread_id: activeThreadId!,
                  role: 'assistant',
                  content: accumulated,
                  agent_id: activeAgentPartial,
                  user_id: null,
                  streaming: false,
                  streaming_complete: true,
                  metadata: {},
                  created_at: new Date().toISOString(),
                }
                setMessages((prev) => [...prev, partialMsg])
                setStreamingContent('')
              }
              setError(event.message)
            }
          } catch {
            // Partial JSON, skip
          }
        }
      }

      if (pendingFlush && accumulated) {
        setStreamingContent(accumulated)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message'
      setError(msg)
    } finally {
      setIsLoading(false)
      setStreamingContent('')
      fetchThreads()
    }
  }, [activeThreadId, isLoading])

  // ---------------------------------------------------------------------------
  // Channel send message (with Makima streaming)
  // ---------------------------------------------------------------------------
  const sendChannelMessage = useCallback(async (content: string) => {
    if (!activeChannelId || isChannelLoading) return

    setChannelError(null)
    setIsChannelLoading(true)
    setChannelStreamingContent('')

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
    setChannelMessages((prev) => [...prev, optimistic])
    setReplyingTo(null)

    try {
      // Save user message to channel
      const saveRes = await fetch(`/api/channels/${activeChannelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content,
          replyToId: replyingTo?.id ?? undefined,
        }),
      })
      const savedUserMsg = await saveRes.json()
      // Replace optimistic with real
      setChannelMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? savedUserMsg : m))
      )

      // Now get Makima's response via /api/chat/channel-reply
      const res = await fetch('/api/chat/channel-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: activeChannelId, content }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let accumulated = ''
      let sseBuffer = ''
      let pendingFlush = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)
          if (!jsonStr.trim()) continue

          try {
            const event = JSON.parse(jsonStr)
            if (event.type === 'typing') {
              setIsTyping(true)
              continue
            } else if (event.type === 'chunk') {
              setIsTyping(false)
              accumulated += event.content
              if (!pendingFlush) {
                pendingFlush = true
                requestAnimationFrame(() => {
                  setChannelStreamingContent(accumulated)
                  pendingFlush = false
                })
              }
            } else if (event.type === 'done') {
              pendingFlush = false
              const assistantMsg: ChannelMessageType = {
                id: event.messageId || `done-${Date.now()}`,
                channel_id: activeChannelId!,
                role: 'assistant',
                content: accumulated,
                agent_id: event.agentId || 'makima',
                reply_to_id: null,
                thread_id: null,
                thread_count: 0,
                forwarded_from: null,
                created_at: new Date().toISOString(),
              }
              setChannelMessages((prev) => {
                if (prev.some((m) => m.id === assistantMsg.id)) return prev
                return [...prev, assistantMsg]
              })
              setChannelStreamingContent('')
            } else if (event.type === 'error') {
              pendingFlush = false
              if (accumulated) {
                const partialMsg: ChannelMessageType = {
                  id: `partial-${Date.now()}`,
                  channel_id: activeChannelId!,
                  role: 'assistant',
                  content: accumulated,
                  agent_id: 'makima',
                  reply_to_id: null,
                  thread_id: null,
                  thread_count: 0,
                  forwarded_from: null,
                  created_at: new Date().toISOString(),
                }
                setChannelMessages((prev) => [...prev, partialMsg])
                setChannelStreamingContent('')
              }
              setChannelError(event.message)
            }
          } catch {
            // Partial JSON, skip
          }
        }
      }

      if (pendingFlush && accumulated) {
        setChannelStreamingContent(accumulated)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message'
      setChannelError(msg)
    } finally {
      setIsChannelLoading(false)
      setChannelStreamingContent('')
    }
  }, [activeChannelId, isChannelLoading, replyingTo])

  // ---------------------------------------------------------------------------
  // Channel thread & forward handlers
  // ---------------------------------------------------------------------------
  const handleThreadReply = useCallback(
    async (content: string) => {
      if (!activeChannelId || !threadParent || isThreadLoading) return

      setIsThreadLoading(true)
      setThreadStreamingContent('')
      setIsThreadTyping(false)

      // Optimistic user message
      const optimistic: ChannelMessageType = {
        id: `temp-${Date.now()}`,
        channel_id: activeChannelId,
        role: 'user',
        content,
        agent_id: null,
        reply_to_id: null,
        thread_id: threadParent.id,
        thread_count: 0,
        forwarded_from: null,
        created_at: new Date().toISOString(),
      }
      setThreadReplies((prev) => [...prev, optimistic])

      try {
        // Save user message to channel thread
        const saveRes = await fetch(`/api/channels/${activeChannelId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'user',
            content,
            threadId: threadParent.id,
          }),
        })
        const savedUserMsg = await saveRes.json()
        // Replace optimistic with real
        setThreadReplies((prev) =>
          prev.map((m) => (m.id === optimistic.id ? savedUserMsg : m))
        )
        setChannelMessages((prev) =>
          prev.map((m) =>
            m.id === threadParent.id
              ? { ...m, thread_count: m.thread_count + 1 }
              : m
          )
        )

        // Trigger Makima's response via channel-reply with threadId
        const res = await fetch('/api/chat/channel-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelId: activeChannelId,
            content,
            threadId: threadParent.id,
          }),
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response stream')

        const decoder = new TextDecoder()
        let accumulated = ''
        let sseBuffer = ''
        let pendingFlush = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          sseBuffer += decoder.decode(value, { stream: true })
          const lines = sseBuffer.split('\n')
          sseBuffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6)
            if (!jsonStr.trim()) continue

            try {
              const event = JSON.parse(jsonStr)
              if (event.type === 'typing') {
                setIsThreadTyping(true)
                continue
              } else if (event.type === 'chunk') {
                setIsThreadTyping(false)
                accumulated += event.content
                if (!pendingFlush) {
                  pendingFlush = true
                  requestAnimationFrame(() => {
                    setThreadStreamingContent(accumulated)
                    pendingFlush = false
                  })
                }
              } else if (event.type === 'done') {
                pendingFlush = false
                const assistantMsg: ChannelMessageType = {
                  id: event.messageId || `done-${Date.now()}`,
                  channel_id: activeChannelId!,
                  role: 'assistant',
                  content: accumulated,
                  agent_id: event.agentId || 'makima',
                  reply_to_id: null,
                  thread_id: threadParent.id,
                  thread_count: 0,
                  forwarded_from: null,
                  created_at: new Date().toISOString(),
                }
                setThreadReplies((prev) => [...prev, assistantMsg])
                setThreadStreamingContent('')
                // Update parent thread count
                setChannelMessages((prev) =>
                  prev.map((m) =>
                    m.id === threadParent.id
                      ? { ...m, thread_count: m.thread_count + 1 }
                      : m
                  )
                )
              } else if (event.type === 'error') {
                console.error('Thread reply error:', event.message)
              }
            } catch (parseErr) {
              // Skip invalid JSON
            }
          }
        }
      } catch (err) {
        console.error('Failed to send thread reply:', err)
      } finally {
        setIsThreadLoading(false)
        setIsThreadTyping(false)
        setThreadStreamingContent('')
      }
    },
    [activeChannelId, threadParent, isThreadLoading]
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

  // ---------------------------------------------------------------------------
  // Channel management handlers
  // ---------------------------------------------------------------------------
  const handleCreateChannel = useCallback(
    async (categoryId: string | null) => {
      console.log('[chat] handleCreateChannel called with categoryId:', categoryId)
      // Use prompt - might not work in Tauri
      const name = window.prompt('Channel name:')
      console.log('[chat] prompt result:', name)
      if (!name?.trim()) {
        console.log('[chat] No name provided, returning')
        return
      }
      try {
        console.log('[chat] Creating channel:', name.trim())
        const res = await fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'channel', name: name.trim(), categoryId }),
        })
        const channel = await res.json()
        console.log('[chat] Channel created:', channel)
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

  // ---------------------------------------------------------------------------
  // Derived for DM view
  // ---------------------------------------------------------------------------
  const activeAgent = threads.find(t => t.id === activeThreadId)?.agent_id
  const isMakima = activeAgent === 'makima'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Unified sidebar */}
      <div className={`${sidebarOpen ? 'w-72 fixed inset-y-0 left-0 z-40 md:relative md:z-auto' : 'w-0'} flex-shrink-0 border-r border-border bg-background transition-all duration-200 overflow-hidden`}>
        <UnifiedSidebar
          // DM props
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={(id) => {
            selectThread(id)
            if (window.innerWidth < 768) setSidebarOpen(false)
          }}
          onNewThread={() => setAgentSelectorOpen(true)}
          isCreating={isCreatingThread}
          onArchive={handleArchiveThread}
          onDelete={handleDeleteThread}
          onRename={handleRenameThread}
          showArchived={showArchived}
          onToggleArchived={handleToggleArchived}
          // Channel props
          categories={categories}
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={(id) => {
            selectChannel(id)
            if (window.innerWidth < 768) setSidebarOpen(false)
          }}
          onCreateChannel={handleCreateChannel}
          onCreateCategory={handleCreateCategory}
          onToggleCategory={handleToggleCategory}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 border-b border-border bg-background">
          <Link
            href="/dashboard"
            className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          {viewContext?.type === 'dm' && (
            <>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium">
                  Shoin Chat
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                {threads.find(t => t.id === activeThreadId)?.title}
              </span>
              {isMakima && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400/80 font-[family-name:var(--font-jetbrains-mono)]">
                    Pulse active
                  </span>
                </div>
              )}
            </>
          )}

          {viewContext?.type === 'channel' && activeChannel && (
            <div className="flex items-center gap-1.5">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium">
                {activeChannel.name}
              </span>
            </div>
          )}

          {!viewContext && (
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium">
                Shoin Chat
              </span>
            </div>
          )}
        </div>

        {/* DM view */}
        {viewContext?.type === 'dm' && (
          <>
            <MessageArea
              messages={messages}
              streamingContent={streamingContent}
              isLoading={isLoading}
              isTyping={isTyping}
              isFetching={isFetchingMessages}
              agentId={threads.find(t => t.id === activeThreadId)?.agent_id}
            />
            {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
              <ChatActions
                messageContent={messages[messages.length - 1].content}
                threadId={activeThreadId!}
                onCouncilCreated={(sessionId) => {
                  const systemMsg: ChatMessage = {
                    id: `council-${sessionId}`,
                    thread_id: activeThreadId!,
                    role: 'system',
                    content: `Council review ready -> /council/${sessionId}`,
                    agent_id: null,
                    user_id: null,
                    streaming: false,
                    streaming_complete: true,
                    metadata: {},
                    created_at: new Date().toISOString(),
                  }
                  setMessages((prev) => [...prev, systemMsg])
                }}
              />
            )}
            {error && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
            <ChatInput
              threadId={activeThreadId!}
              onSend={sendMessage}
              isLoading={isLoading}
              agentName={activeAgent === 'makima' ? 'Makima' : activeAgent === 'cc' ? 'Claude Code' : activeAgent ? activeAgent.charAt(0).toUpperCase() + activeAgent.slice(1) : 'Agent'}
            />
          </>
        )}

        {/* Channel view */}
        {viewContext?.type === 'channel' && (
          <>
            <div className="flex-1 overflow-y-auto">
              {channelMessages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center h-full">
                  <p className="text-muted-foreground text-sm">
                    No messages yet. Start the conversation.
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {channelMessages.map((msg) => (
                    <ChannelMessageBubble
                      key={msg.id}
                      message={msg}
                      onReply={(m) => setReplyingTo(m)}
                      onForward={(m) => setForwardingMessage(m)}
                      onThread={(m) => setThreadParent(m)}
                      replyToMessage={
                        msg.reply_to_id
                          ? channelMessagesById.get(msg.reply_to_id) ?? null
                          : null
                      }
                    />
                  ))}
                  {/* Streaming indicator for channel */}
                  {channelStreamingContent && (
                    <div className="px-4 py-2">
                      <div className="flex items-start gap-3">
                        <img
                          src="/avatars/makima.webp"
                          alt="Makima"
                          className="h-8 w-8 rounded-full object-cover flex-shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-emerald-400">Makima</span>
                          <div className="text-sm text-foreground/90 whitespace-pre-wrap mt-0.5">
                            {channelStreamingContent}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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

            {channelError && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
                <p className="text-xs text-red-400">{channelError}</p>
              </div>
            )}

            <ChatInput
              threadId={activeChannelId!}
              onSend={sendChannelMessage}
              isLoading={isChannelLoading}
            />
          </>
        )}

        {/* Empty state */}
        {!viewContext && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Zap className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Select a thread or channel</p>
            </div>
          </div>
        )}
      </div>

      {/* Thread panel (channel threads) */}
      {threadParent && (
        <ThreadPanel
          parentMessage={threadParent}
          replies={threadReplies}
          onClose={() => setThreadParent(null)}
          onSendReply={handleThreadReply}
          isLoading={isThreadLoading}
          streamingContent={threadStreamingContent}
          isTyping={isThreadTyping}
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

      {/* Agent selector for new DM */}
      <AgentSelector
        open={agentSelectorOpen}
        onSelect={(agentId) => {
          setAgentSelectorOpen(false)
          createThread(agentId)
        }}
        onClose={() => setAgentSelectorOpen(false)}
      />
    </div>
  )
}
