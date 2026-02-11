"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { ThreadList, type ThreadSummary } from '@/components/chat/thread-list'
import { MessageArea } from '@/components/chat/message-area'
import { ChatInput } from '@/components/chat/chat-input'
import { supabase } from '@/lib/supabase'
import type { ChatMessage } from '@/lib/chat'
import { ChevronLeft, Menu, Zap } from 'lucide-react'
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
          // Dedup: only add if we don't already have this message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
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

  const fetchThreads = async () => {
    try {
      const res = await fetch('/api/chat/threads')
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

  const createThread = async () => {
    setIsCreatingThread(true)
    try {
      const res = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Thread' }),
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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)
          if (!jsonStr.trim()) continue

          try {
            const event = JSON.parse(jsonStr)
            if (event.type === 'chunk') {
              accumulated += event.content
              setStreamingContent(accumulated)
            } else if (event.type === 'done') {
              // Response complete — clear streaming, let Realtime add the DB message
              setStreamingContent('')
            } else if (event.type === 'error') {
              setError(event.message)
            }
          } catch {
            // Partial JSON, skip
          }
        }
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

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Thread sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} flex-shrink-0 border-r border-zinc-800 bg-zinc-950 transition-all duration-200 overflow-hidden`}>
        <ThreadList
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={(id) => {
            selectThread(id)
            // Close sidebar on mobile
            if (window.innerWidth < 768) setSidebarOpen(false)
          }}
          onNewThread={createThread}
          isCreating={isCreatingThread}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-950">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 w-8 rounded-md hover:bg-zinc-800 flex items-center justify-center transition-colors md:hidden"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium">
              Shoin Chat
            </span>
          </Link>

          {activeThreadId && (
            <span className="text-xs text-zinc-500 font-[family-name:var(--font-jetbrains-mono)]">
              {threads.find(t => t.id === activeThreadId)?.title}
            </span>
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
            />
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
              <Zap className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Select a thread or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — future canvas placeholder */}
      <div className="hidden lg:block w-0 border-l border-zinc-800" />
    </div>
  )
}
