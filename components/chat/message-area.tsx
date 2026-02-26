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
  agentId?: string | null
  isTyping?: boolean
}

export function MessageArea({ messages, streamingContent, isLoading, isFetching, agentId, isTyping }: MessageAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  if (isFetching) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (messages.length === 0 && !streamingContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">Start a conversation</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Messages are sent to Claude Code</p>
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
          agentId={agentId || 'cc'}
          isStreaming={isLoading}
        />
      )}
      {/* Typing indicator — bouncing dots while waiting for first chunk */}
      {isTyping && !streamingContent && (
        <div data-testid="typing-indicator" className="flex items-center gap-1 px-4 py-3">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
