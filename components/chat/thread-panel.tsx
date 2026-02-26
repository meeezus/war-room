"use client"

import { useState, useRef, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import { ChannelMessage as ChannelMessageBubble } from './channel-message'
import type { ChannelMessage } from '@/lib/channels'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThreadPanelProps {
  parentMessage: ChannelMessage
  replies: ChannelMessage[]
  onClose: () => void
  onSendReply: (content: string) => void
  isLoading?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreadPanel({
  parentMessage,
  replies,
  onClose,
  onSendReply,
  isLoading = false,
}: ThreadPanelProps) {
  const [input, setInput] = useState('')
  const repliesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new replies arrive
  useEffect(() => {
    if (typeof repliesEndRef.current?.scrollIntoView === 'function') {
      repliesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [replies.length])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSendReply(trimmed)
    setInput('')
  }

  const replyCount = replies.length
  const replyLabel = replyCount === 1 ? '1 reply' : `${replyCount} replies`

  return (
    <div
      data-testid="thread-panel"
      className="w-80 border-l border-border bg-background h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Thread</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Parent message */}
      <div className="border-b border-border">
        <ChannelMessageBubble message={parentMessage} />
      </div>

      {/* Replies section */}
      <div className="flex-1 overflow-y-auto">
        {/* Reply count */}
        <div className="px-4 py-2 text-xs text-muted-foreground">
          {replyLabel}
        </div>

        {/* Reply list */}
        {replies.map((reply) => (
          <ChannelMessageBubble key={reply.id} message={reply} />
        ))}

        {/* Scroll anchor */}
        <div ref={repliesEndRef} />
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
            aria-label="Send"
            className="h-9 w-9 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </form>
    </div>
  )
}
