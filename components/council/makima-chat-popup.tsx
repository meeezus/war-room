"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"

interface MakimaChatPopupProps {
  open: boolean
  onClose: () => void
  sessionId: string
  sessionTopic: string
}

interface Message {
  role: "user" | "assistant"
  content: string
}

export function MakimaChatPopup({ open, onClose, sessionId, sessionTopic }: MakimaChatPopupProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: text }])
    setLoading(true)

    // Append placeholder for assistant message
    setMessages((prev) => [...prev, { role: "assistant", content: "" }])

    try {
      const res = await fetch("/api/chat/makima-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: `Council session: ${sessionTopic}`,
        }),
      })

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: "assistant", content: "Something went wrong." }
          return updated
        })
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const parsed = JSON.parse(line.slice(6))
            if (parsed.type === "chunk" && parsed.content) {
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: updated[updated.length - 1].content + parsed.content,
                }
                return updated
              })
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: "assistant", content: "Connection failed." }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-[400px] h-[500px] flex flex-col
        bg-[rgba(10,10,10,0.95)] border border-white/[0.08] rounded-lg backdrop-blur-xl shadow-2xl
        transition-all duration-200
        ${open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
        <div className="relative w-8 h-8 flex-shrink-0">
          <Image
            src="/avatars/makima.webp"
            alt="Makima"
            width={32}
            height={32}
            className="rounded-full ring-1 ring-red-500/30 object-cover"
          />
        </div>
        <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-[#E5E5E5] flex-1">
          Makima
        </span>
        <button
          onClick={onClose}
          className="text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.7)] transition-colors text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-[rgba(255,255,255,0.3)] text-center mt-8">
            Ask Makima about this session
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded text-sm text-[rgba(255,255,255,0.8)] whitespace-pre-wrap break-words
                ${msg.role === "user"
                  ? "bg-white/[0.08]"
                  : "bg-red-500/[0.06] border-l-2 border-red-500/30"
                }`}
            >
              {msg.content || (msg.role === "assistant" && loading ? (
                <span className="inline-block w-4 h-3 border-r-2 border-red-400/60 animate-pulse" />
              ) : null)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Makima..."
          disabled={loading}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-sm px-3 py-2 text-sm text-[#E5E5E5]
            placeholder:text-[rgba(255,255,255,0.25)] outline-none focus:border-red-500/30
            disabled:opacity-50 transition-colors"
        />
      </div>
    </div>
  )
}
