"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CouncilSynthesis } from "@/components/council/council-synthesis"
import { CouncilActions } from "@/components/council/council-actions"
import type { CouncilSession } from "@/lib/types"

interface CouncilSessionClientProps {
  session: CouncilSession
}

export function CouncilSessionClient({ session }: CouncilSessionClientProps) {
  const router = useRouter()
  const [archiving, setArchiving] = useState(false)

  const hasSynthesis = !!(session.synthesis || session.recommendation)

  async function handleAccept() {
    // Open the create project modal by triggering CouncilActions
    // We scroll to actions bar and let the user pick project/mission
    const actionsEl = document.getElementById("council-actions-bar")
    if (actionsEl) {
      actionsEl.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  async function handleReject() {
    if (archiving) return
    setArchiving(true)
    try {
      const res = await fetch(`/api/council/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      })
      if (res.ok) {
        router.push("/council")
      }
    } finally {
      setArchiving(false)
    }
  }

  function handleIterate() {
    const terminal = document.querySelector("[data-council-terminal]")
    if (terminal) {
      terminal.scrollIntoView({ behavior: "smooth", block: "center" })
      // Focus the input inside the terminal panel if it exists
      const input = terminal.querySelector("input, textarea") as HTMLElement | null
      if (input) {
        setTimeout(() => input.focus(), 400)
      }
    }
  }

  return (
    <>
      {/* Makima synthesis — full-width distinct block */}
      {hasSynthesis && (
        <CouncilSynthesis
          session={session}
          onAccept={handleAccept}
          onReject={handleReject}
          onIterate={handleIterate}
        />
      )}

      {/* Action bar — create project/mission from council output */}
      <div id="council-actions-bar">
        <CouncilActions session={session} />
      </div>
    </>
  )
}
