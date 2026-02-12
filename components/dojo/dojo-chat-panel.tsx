"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send } from 'lucide-react'
import type { AgentStatus } from '@/lib/types'

interface DojoChatPanelProps {
  agent: AgentStatus | null
  open: boolean
  onClose: () => void
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const AGENT_EMOJI: Record<string, string> = {
  pip: '\u{1F916}',
  cc: '\u{1F916}',
  ed: '\u2694\uFE0F',
  light: '\u{1F4A1}',
  toji: '\u{1F4B0}',
  power: '\u26A1',
  major: '\u{1F3AF}',
}

export function DojoChatPanel({ agent, open, onClose }: DojoChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentAgentRef = useRef<string | null>(null)

  // Reset state when agent changes
  useEffect(() => {
    if (agent && agent.name !== currentAgentRef.current) {
      setMessages([])
      setThreadId(null)
      setInput('')
      currentAgentRef.current = agent.name
    }
  }, [agent])

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Close on Escape or B (when input not focused)
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key.toLowerCase() === 'b' && document.activeElement !== inputRef.current) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming || !agent) return

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setStreaming(true)

    try {
      // Create thread if needed
      let tid = threadId
      if (!tid) {
        const res = await fetch('/api/chat/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Dojo: ${agent.display_name}`,
            agentId: agent.name,
          }),
        })
        if (!res.ok) throw new Error('Failed to create thread')
        const data = await res.json()
        tid = data.thread.id
        setThreadId(tid)
      }

      // Send message via SSE
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: tid, content: text }),
      })

      if (!res.ok || !res.body) throw new Error('Chat request failed')

      // Add empty assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(line.slice(6))
            if (parsed.type === 'chunk' && parsed.content) {
              fullResponse += parsed.content
              const captured = fullResponse
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: captured }
                return updated
              })
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      console.error('Dojo chat error:', err)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Try again.' },
      ])
    } finally {
      setStreaming(false)
    }
  }, [agent, streaming, threadId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const emoji = agent ? (AGENT_EMOJI[agent.name.toLowerCase()] || '\u{1F916}') : '\u{1F916}'

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${
        open ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ height: '40vh', minHeight: '280px' }}
    >
      <div className="h-full bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{emoji}</span>
            <span className="font-[family-name:var(--font-space-grotesk)] font-semibold text-zinc-100">
              {agent?.display_name || 'Agent'}
            </span>
            <span className="text-xs text-zinc-500 font-[family-name:var(--font-jetbrains-mono)]">
              {agent?.domain}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors font-[family-name:var(--font-jetbrains-mono)]"
          >
            <span>Esc</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-zinc-500 text-sm font-[family-name:var(--font-jetbrains-mono)] py-8">
              Start talking to {agent?.display_name || 'the agent'}...
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-emerald-600/20 text-emerald-100 border border-emerald-600/30'
                    : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                }`}
              >
                {msg.content || (streaming && i === messages.length - 1 ? '' : '')}
                {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                  <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse ml-1 align-middle" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="shrink-0 px-4 py-3 border-t border-zinc-800">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={streaming ? 'Waiting for response...' : 'Type a message...'}
              disabled={streaming}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-600 font-[family-name:var(--font-jetbrains-mono)] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
