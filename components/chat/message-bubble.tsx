"use client"

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { Bot, User, Code2 } from 'lucide-react'
import { useState } from 'react'

function isHtmlContent(content: string): boolean {
  const trimmed = content.trimStart()
  return (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<HTML')
  )
}

function HtmlVisual({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-1 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between bg-muted/80 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
            HTML Visual
          </span>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
        >
          {expanded ? 'collapse' : 'expand'}
        </button>
      </div>
      <iframe
        srcDoc={content}
        sandbox="allow-scripts"
        title="HTML Visual"
        className="w-full bg-white transition-all duration-300"
        style={{ height: expanded ? '600px' : '320px', border: 'none', display: 'block' }}
      />
    </div>
  )
}

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const isBlock = Boolean(className)
    return isBlock ? (
      <code className={className} {...props}>
        {children}
      </code>
    ) : (
      <code
        className="bg-muted px-1.5 py-0.5 rounded text-sm text-emerald-300"
        {...props}
      >
        {children}
      </code>
    )
  },
  pre({ children, ...props }) {
    return (
      <pre
        className="bg-background border border-border rounded-lg p-4 overflow-x-auto"
        {...props}
      >
        {children}
      </pre>
    )
  },
  table({ children, ...props }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full text-sm border-collapse" {...props}>
          {children}
        </table>
      </div>
    )
  },
  th({ children, ...props }) {
    return (
      <th
        className="border border-border bg-muted/50 px-3 py-1.5 text-left text-xs font-medium text-foreground/80"
        {...props}
      >
        {children}
      </th>
    )
  },
  td({ children, ...props }) {
    return (
      <td
        className="border border-border px-3 py-1.5 text-muted-foreground"
        {...props}
      >
        {children}
      </td>
    )
  },
}

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
    // Detect council links: "Council review ready → /council/uuid"
    const councilMatch = content.match(/→ (\/council\/[\w-]+)/)
    return (
      <div className="flex justify-center py-2">
        {councilMatch ? (
          <a
            href={councilMatch[1]}
            className="text-xs text-purple-400 hover:text-purple-300 italic transition-colors"
          >
            {content}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground italic">{content}</span>
        )}
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {isUser ? (
        <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-emerald-500/20">
          <User className="h-4 w-4 text-emerald-400" />
        </div>
      ) : agentId && agentId !== 'cc' ? (
        <img
          src={`/avatars/${agentId}.webp`}
          alt={agentId}
          className="flex-shrink-0 h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-muted">
          <Bot className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Message content */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {!isUser && agentId && (
          <span className="text-[10px] text-muted-foreground mb-1 font-[family-name:var(--font-jetbrains-mono)]">
            {agentId === 'cc' ? 'Claude Code' : agentId.charAt(0).toUpperCase() + agentId.slice(1)}
          </span>
        )}
        <div className={`rounded-lg ${
          isHtmlContent(content)
            ? 'bg-muted border border-border/50 overflow-hidden'
            : isUser
              ? 'bg-muted text-foreground px-4 py-2.5'
              : 'bg-muted text-foreground border border-border/50 px-4 py-2.5'
        }`}>
          {isHtmlContent(content) ? (
            <HtmlVisual content={content} />
          ) : (
            <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_pre]:my-2 [&_code]:text-emerald-300 [&_pre]:bg-background [&_pre]:rounded [&_pre]:p-3 [&_pre]:overflow-x-auto [&_a]:text-emerald-400 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
          {isStreaming && (
            <span className="inline-flex gap-1 mt-1 px-4 pb-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>
        {timestamp && (
          <span className="text-[10px] text-muted-foreground/60 mt-1 font-[family-name:var(--font-jetbrains-mono)]">
            {new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}
