"use client"

import { useState } from "react"
import { CouncilSynthesis } from "@/components/council/council-synthesis"
import { CouncilActions } from "@/components/council/council-actions"
import { MakimaChatPopup } from "@/components/council/makima-chat-popup"
import type { CouncilSession } from "@/lib/types"

interface CouncilSessionClientProps {
  session: CouncilSession
}

export function CouncilSessionClient({ session }: CouncilSessionClientProps) {
  const hasSynthesis = !!(session.synthesis || session.recommendation)
  const [chatOpen, setChatOpen] = useState(false)
  const [makimaThreadId, setMakimaThreadId] = useState<string | null>(null)
  const [resolved, setResolved] = useState(session.status === 'resolved')
  const [resolving, setResolving] = useState(false)

  async function handleResolve() {
    setResolving(true)
    try {
      const res = await fetch(`/api/council/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      })
      if (res.ok) {
        setResolved(true)
      }
    } finally {
      setResolving(false)
    }
  }

  return (
    <>
      {/* Makima synthesis — full-width distinct block */}
      {hasSynthesis && (
        <CouncilSynthesis session={session} />
      )}

      {/* Action bar — create project/mission from council output */}
      <div id="council-actions-bar">
        <CouncilActions session={session} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setChatOpen(true)}
          className="px-3 py-1.5 rounded-sm border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
        >
          Talk to Makima
        </button>

        {resolved ? (
          <span className="px-3 py-1.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium inline-flex items-center gap-1.5 cursor-default">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Resolved
          </span>
        ) : (
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="px-3 py-1.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {resolving ? 'Resolving...' : 'Resolve'}
          </button>
        )}
      </div>

      <MakimaChatPopup
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        sessionId={session.id}
        sessionTopic={session.topic}
        threadId={makimaThreadId}
        onThreadCreated={setMakimaThreadId}
      />
    </>
  )
}
