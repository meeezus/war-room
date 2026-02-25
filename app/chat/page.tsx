"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { ThreadList, type ThreadSummary } from '@/components/chat/thread-list'
import { MessageArea } from '@/components/chat/message-area'
import { ChatInput } from '@/components/chat/chat-input'
import { AgentSelector } from '@/components/chat/agent-selector'
import { ChatActions } from '@/components/chat/chat-actions'
import { supabase } from '@/lib/supabase'
import type { ChatMessage } from '@/lib/chat'
import { ArrowLeft, ChevronLeft, Menu, Zap } from 'lucide-react'
import Link from 'next/link'
import type { RealtimeChannel } from '@supabase/supabase-js'

export default function ChatPage() {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingMessages, setIsFetchingMessages] = useState(false)
  const [isCreatingThread, setIsCreatingThread] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [agentSelectorOpen, setAgentSelectorOpen] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Fetch threads on mount
  useEffect(() => {
    fetchThreads()
  }, [])

  // Subscribe to Realtime for active thread messages
  useEffect(() => {
    if (!activeThreadId || !supabase) return

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`chat-messages-${activeThreadId}`)
      .on(
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
            // Exact ID match — already have this message
            if (prev.some((m) => m.id === newMsg.id)) return prev
            // Optimistic dedup: replace temp message with real DB message
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
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase?.removeChannel(channel)
      channelRef.current = null
    }
  }, [activeThreadId])

  // Subscribe to thread list updates
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('chat-threads-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_threads' },
        () => {
          // Refresh thread list on any change
          fetchThreads()
        }
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [])

  const fetchThreads = async (archived = showArchived) => {
    try {
      const status = archived ? 'archived' : 'active'
      const res = await fetch(`/api/chat/threads?status=${status}`)
      const data = await res.json()
      if (data.threads) {
        setThreads(data.threads)
        // Auto-select first thread if none selected
        if (!activeThreadId && data.threads.length > 0) {
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
    setActiveThreadId(threadId)
    setMessages([])
    setStreamingContent('')
    setError(null)
    fetchMessages(threadId)
  }

  const createThread = async (agentId?: string) => {
    setIsCreatingThread(true)
    try {
      const res = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Thread', agentId: agentId || 'cc' }),
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

  const sendMessage = useCallback(async (content: string) => {
    if (!activeThreadId || isLoading) return

    setError(null)
    setIsLoading(true)
    setStreamingContent('')

    // Optimistically add user message
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
      // Batch streaming updates to avoid overwhelming React with rapid setState calls.
      // Chunks arrive faster than 60fps — we coalesce them and flush once per frame.
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
              // Server signals it's working — typing indicator already shows
              // via isLoading && !streamingContent in MessageArea
              continue
            } else if (event.type === 'chunk') {
              accumulated += event.content
              // Batch: schedule a single React update per animation frame.
              // Multiple chunks between frames get coalesced into one setState.
              if (!pendingFlush) {
                pendingFlush = true
                requestAnimationFrame(() => {
                  // Read `accumulated` at flush time so we get ALL chunks
                  // that arrived since the rAF was scheduled, not a stale snapshot
                  setStreamingContent(accumulated)
                  pendingFlush = false
                })
              }
            } else if (event.type === 'done') {
              // Flush any remaining accumulated content before completing
              // Cancel any pending rAF — we set final state synchronously
              pendingFlush = false
              // Add the complete message directly to state
              // Don't rely solely on Realtime (WebSocket can be flaky)
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
              // If we already have content, keep it as the message
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

      // Flush final accumulated content if rAF didn't fire yet
      if (pendingFlush && accumulated) {
        setStreamingContent(accumulated)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message'
      setError(msg)
    } finally {
      setIsLoading(false)
      setStreamingContent('')
      // Refresh thread list to update last_message
      fetchThreads()
    }
  }, [activeThreadId, isLoading])

  const activeAgent = threads.find(t => t.id === activeThreadId)?.agent_id
  const isMakima = activeAgent === 'makima'

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Thread sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} flex-shrink-0 border-r border-border bg-background transition-all duration-200 overflow-hidden`}>
        <ThreadList
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={(id) => {
            selectThread(id)
            // Close sidebar on mobile
            if (window.innerWidth < 768) setSidebarOpen(false)
          }}
          onNewThread={() => setAgentSelectorOpen(true)}
          isCreating={isCreatingThread}
          onArchive={handleArchiveThread}
          onDelete={handleDeleteThread}
          onRename={handleRenameThread}
          showArchived={showArchived}
          onToggleArchived={handleToggleArchived}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background">
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

          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium">
              Shoin Chat
            </span>
          </div>

          {activeThreadId && (
            <span className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
              {threads.find(t => t.id === activeThreadId)?.title}
            </span>
          )}

          {isMakima && activeThreadId && (
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400/80 font-[family-name:var(--font-jetbrains-mono)]">
                Pulse active
              </span>
            </div>
          )}
        </div>

        {/* Messages */}
        {activeThreadId ? (
          <>
            <MessageArea
              messages={messages}
              streamingContent={streamingContent}
              isLoading={isLoading}
              isFetching={isFetchingMessages}
              agentId={threads.find(t => t.id === activeThreadId)?.agent_id}
            />
            {/* Chat actions — show after last assistant message */}
            {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
              <ChatActions
                messageContent={messages[messages.length - 1].content}
                threadId={activeThreadId}
                onCouncilCreated={(sessionId) => {
                  const systemMsg: ChatMessage = {
                    id: `council-${sessionId}`,
                    thread_id: activeThreadId,
                    role: 'system',
                    content: `Council review ready → /council/${sessionId}`,
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
              threadId={activeThreadId}
              onSend={sendMessage}
              isLoading={isLoading}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Zap className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Select a thread or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — future canvas placeholder */}
      <div className="hidden lg:block w-0 border-l border-border" />

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
