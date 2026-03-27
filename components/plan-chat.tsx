'use client'

import { useState, useRef, useEffect } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface PlanChatProps {
  planId: string
  initialHistory: ChatMessage[]
  onPlanUpdated?: () => void
}

export function PlanChat({ planId, initialHistory, onPlanUpdated }: PlanChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialHistory)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Keep onPlanUpdated in a ref to avoid stale closures
  const onPlanUpdatedRef = useRef(onPlanUpdated)
  onPlanUpdatedRef.current = onPlanUpdated

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const sendMessage = async () => {
    if (!input.trim() || streaming) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStreamingText('')

    try {
      const res = await fetch(`/api/plans/${planId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content }),
      })

      if (res.headers.get('content-type')?.includes('text/plain')) {
        // Streaming response
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let fullText = ''

        while (reader) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          fullText += chunk
          setStreamingText(fullText)
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: fullText.trim(),
            timestamp: new Date().toISOString(),
          },
        ])
        setStreamingText('')
        onPlanUpdatedRef.current?.()
      } else {
        // JSON response (Vercel fallback)
        const data = await res.json()
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.message || 'Processing... refresh in a moment.',
            timestamp: new Date().toISOString(),
          },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error - try again',
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !streaming && (
          <p className="text-sm text-muted-foreground/40 text-center py-8">
            Chat about this plan — ask questions, give feedback, iterate.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-card border border-border/50 text-foreground'
              }`}
            >
              <pre className="whitespace-pre-wrap font-[family-name:var(--font-space-grotesk)] text-[13px] leading-relaxed">
                {msg.content}
              </pre>
            </div>
          </div>
        ))}

        {streaming && streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-card border border-border/50">
              <pre className="whitespace-pre-wrap font-[family-name:var(--font-space-grotesk)] text-[13px] leading-relaxed">
                {streamingText}
                <span className="animate-pulse">&#9610;</span>
              </pre>
            </div>
          </div>
        )}

        {streaming && !streamingText && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 text-sm bg-card border border-border/50">
              <span className="text-muted-foreground/60 animate-pulse">
                Thinking...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/50 p-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Iterate on this plan..."
            className="flex-1 h-10 min-h-[40px] max-h-[120px] p-2 rounded-sm border border-border/50 bg-card text-sm text-foreground font-[family-name:var(--font-space-grotesk)] placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/50"
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            className="px-4 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium disabled:opacity-30 transition-opacity"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
