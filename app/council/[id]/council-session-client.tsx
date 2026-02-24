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

      <div className="mt-4">
        <button
          onClick={() => setChatOpen(true)}
          className="px-3 py-1.5 rounded-sm border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
        >
          Talk to Makima
        </button>
      </div>

      <MakimaChatPopup
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        sessionId={session.id}
        sessionTopic={session.topic}
      />
    </>
  )
}
