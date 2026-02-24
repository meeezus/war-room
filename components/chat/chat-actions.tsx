"use client"

import { useState, useEffect } from 'react'

interface ChatActionsProps {
  messageContent: string
  threadId: string
  onCouncilCreated?: (sessionId: string) => void
}

export function ChatActions({ threadId, onCouncilCreated }: ChatActionsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(null), 3000)
    return () => clearTimeout(timer)
  }, [success])

  const handleSendToCouncil = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/chat/council', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create council session')
      }
      const data = await res.json()
      const sessionId = data.session.id
      onCouncilCreated?.(sessionId)
      setSuccess(`Council session created`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send to council')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-2 border-t border-zinc-800/50">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSendToCouncil}
          disabled={isSubmitting}
          className="text-xs px-3 py-1.5 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Council deliberating...' : 'Send to Council'}
        </button>
      </div>

      {success && (
        <p className="text-xs text-emerald-400">{success}</p>
      )}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
