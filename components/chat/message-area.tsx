"use client"

import { useEffect, useRef } from 'react'
import { MessageBubble } from './message-bubble'
import { Loader2 } from 'lucide-react'
import type { ChatMessage } from '@/lib/chat'

interface MessageAreaProps {
  messages: ChatMessage[]
  streamingContent?: string
  isLoading?: boolean
  isFetching?: boolean
}

export function MessageArea({ messages, streamingContent, isLoading, isFetching }: MessageAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  if (isFetching) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-zinc-500 animate-spin" />
      </div>
    )
  }

  if (messages.length === 0 && !streamingContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 text-sm">Start a conversation</p>
          <p className="text-zinc-600 text-xs mt-1">Messages are sent to Claude Code</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          agentId={msg.agent_id}
          timestamp={msg.created_at}
        />
      ))}
      {/* Streaming response in progress */}
      {streamingContent && (
        <MessageBubble
          role="assistant"
          content={streamingContent}
          agentId="cc"
          isStreaming={isLoading}
        />
      )}
      {/* Loading indicator when waiting for first chunk */}
      {isLoading && !streamingContent && (
        <MessageBubble
          role="assistant"
          content=""
          agentId="cc"
          isStreaming
        />
      )}
      <div ref={bottomRef} />
    </div>
  )
}
