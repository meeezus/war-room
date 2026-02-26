"use client"

import { useState } from 'react'
import { Reply, Forward, MessageSquare } from 'lucide-react'
import type { ChannelMessage as ChannelMessageType } from '@/lib/channels'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChannelMessageProps {
  message: ChannelMessageType
  onReply?: (message: ChannelMessageType) => void
  onForward?: (message: ChannelMessageType) => void
  onThread?: (message: ChannelMessageType) => void
  replyToMessage?: ChannelMessageType | null
  forwardedFromMessage?: ChannelMessageType | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function agentDisplayName(agentId: string): string {
  return agentId.charAt(0).toUpperCase() + agentId.slice(1)
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function roleFallbackInitial(role: string): string {
  if (role === 'user') return 'U'
  if (role === 'system') return 'S'
  return 'A'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChannelMessage({
  message,
  onReply,
  onForward,
  onThread,
  replyToMessage,
  forwardedFromMessage,
}: ChannelMessageProps) {
  const [showActions, setShowActions] = useState(false)
  const hasActions = onReply || onForward || onThread
  const isUser = message.role === 'user'

  return (
    <div
      data-testid="channel-message"
      className={`group relative flex gap-3 px-4 py-1.5 hover:bg-muted/40 transition-colors ${isUser ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      {message.agent_id ? (
        <img
          src={`/avatars/${message.agent_id}.webp`}
          alt={message.agent_id}
          className="flex-shrink-0 h-8 w-8 rounded-full object-cover mt-0.5"
        />
      ) : isUser ? (
        <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-emerald-500/20 mt-0.5">
          <span className="text-xs font-medium text-emerald-400">M</span>
        </div>
      ) : (
        <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-muted mt-0.5">
          <span className="text-xs font-medium text-muted-foreground">
            {roleFallbackInitial(message.role)}
          </span>
        </div>
      )}

      {/* Body */}
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
        {/* Header: name + timestamp */}
        <div className={`flex items-baseline gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-sm font-medium text-foreground">
            {message.agent_id
              ? agentDisplayName(message.agent_id)
              : message.role === 'user'
                ? 'You'
                : 'System'}
          </span>
          <span
            data-testid="message-timestamp"
            className="text-[10px] text-muted-foreground/60 font-[family-name:var(--font-jetbrains-mono)]"
          >
            {formatTimestamp(message.created_at)}
          </span>
        </div>

        {/* Forwarded badge */}
        {forwardedFromMessage && (
          <div
            data-testid="forwarded-badge"
            className="flex items-center gap-1 text-[10px] text-muted-foreground italic mb-1"
          >
            <Forward className="h-3 w-3" />
            <span>Forwarded message</span>
          </div>
        )}

        {/* Reply context */}
        {replyToMessage && (
          <div
            data-testid="reply-context"
            className="flex items-start gap-2 mb-1 pl-2 border-l-2 border-muted-foreground/30"
          >
            <div className="text-xs text-muted-foreground truncate max-w-[300px]">
              <span className="font-medium text-muted-foreground/80">
                {replyToMessage.agent_id
                  ? agentDisplayName(replyToMessage.agent_id)
                  : 'User'}
              </span>{' '}
              {replyToMessage.content}
            </div>
          </div>
        )}

        {/* Message content */}
        <div
          data-testid="message-content"
          className="text-sm text-foreground/90"
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {message.content}
        </div>

        {/* Thread badge */}
        {message.thread_count > 0 && (
          <button
            data-testid="thread-badge"
            onClick={() => onThread?.(message)}
            className="flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            <span>{message.thread_count} {message.thread_count === 1 ? 'reply' : 'replies'}</span>
          </button>
        )}
      </div>

      {/* Hover action bar */}
      {showActions && hasActions && (
        <div className={`absolute ${isUser ? 'left-4' : 'right-4'} top-1 flex items-center gap-1 bg-background border border-border rounded-md shadow-sm`}>
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
