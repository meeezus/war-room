'use client'

import { useState, useEffect } from 'react'

interface OuraHealth {
  readiness: number | null
  sleep: number | null
  available: boolean
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 70) return 'text-green-500'
  if (score >= 50) return 'text-amber-500'
  return 'text-red-500'
}

export function OuraBar() {
  const [health, setHealth] = useState<OuraHealth | null>(null)

  useEffect(() => {
    fetch('/api/health/oura')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {})
  }, [])

  if (!health || !health.available) {
    return (
      <span className="text-muted-foreground/40 text-[11px] font-[family-name:var(--font-jetbrains-mono)]">
        Connect Oura
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 text-[11px] font-[family-name:var(--font-jetbrains-mono)]">
      <span className="text-muted-foreground">Readiness</span>
      <span className={scoreColor(health.readiness)}>
        {health.readiness ?? '\u2014'}
      </span>
      <span className="text-muted-foreground/40">&middot;</span>
      <span className="text-muted-foreground">Sleep</span>
      <span className={scoreColor(health.sleep)}>
        {health.sleep ?? '\u2014'}
      </span>
    </span>
  )
}
