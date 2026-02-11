"use client"

import ReactMarkdown from 'react-markdown'
import { Bot, User } from 'lucide-react'

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  agentId?: string | null
  timestamp?: string
  isStreaming?: boolean
}

export function MessageBubble({ role, content, agentId, timestamp, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user'
  const isSystem = role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-zinc-500 italic">{content}</span>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-emerald-500/20' : 'bg-zinc-800'
      }`}>
        {isUser ? (
          <User className="h-4 w-4 text-emerald-400" />
        ) : (
          <Bot className="h-4 w-4 text-zinc-400" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {!isUser && agentId && (
          <span className="text-[10px] text-zinc-500 mb-1 font-[family-name:var(--font-jetbrains-mono)]">
            {agentId === 'cc' ? 'Claude Code' : agentId}
          </span>
        )}
        <div className={`rounded-lg px-4 py-2.5 ${
          isUser
            ? 'bg-zinc-800 text-zinc-100'
            : 'bg-zinc-900 text-zinc-200 border border-zinc-800/50'
        }`}>
          <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_pre]:my-2 [&_code]:text-emerald-300 [&_pre]:bg-zinc-950 [&_pre]:rounded [&_pre]:p-3 [&_pre]:overflow-x-auto [&_a]:text-emerald-400 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
          {isStreaming && (
            <span className="inline-flex gap-1 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>
        {timestamp && (
          <span className="text-[10px] text-zinc-600 mt-1 font-[family-name:var(--font-jetbrains-mono)]">
            {new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}
