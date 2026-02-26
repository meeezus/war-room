"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { StealthCard } from '@/components/stealth-card'

interface RecapItem {
  name: string
  path: string
  size: number
  modified: string
  source: 'diagrams' | 'plans'
}

interface RecapGroup {
  date: string
  recaps: RecapItem[]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

const SOURCE_BADGE: Record<RecapItem['source'], { label: string; className: string }> = {
  diagrams: {
    label: 'diagrams',
    className: 'bg-blue-500/15 text-blue-400',
  },
  plans: {
    label: 'plans',
    className: 'bg-violet-500/15 text-violet-400',
  },
}

export default function RecapsPage() {
  const [groups, setGroups] = useState<RecapGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [activeRecap, setActiveRecap] = useState<RecapItem | null>(null)

  useEffect(() => {
    fetch('/api/recaps')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch recaps')
        return r.json()
      })
      .then((data: { groups: RecapGroup[] }) => {
        setGroups(data.groups)
        // Auto-expand today's group
        const today = todayString()
        const hasToday = data.groups.some(g => g.date === today)
        if (hasToday) {
          setExpandedDates(new Set([today]))
        } else if (data.groups.length > 0) {
          // Fall back to most recent if today has no recaps
          setExpandedDates(new Set([data.groups[0].date]))
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  function toggleDate(date: string) {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  function openRecap(recap: RecapItem) {
    setActiveRecap(recap)
  }

  function closeRecap() {
    setActiveRecap(null)
  }

  const today = todayString()

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs text-muted-foreground hover:text-foreground/60 transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-xs text-muted-foreground/60">/</span>
            <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium text-foreground/60">
              Recaps
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground">
            Ouroboros Recaps
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            HTML plans and diagrams from agent sessions
          </p>
        </div>

        {/* Viewer: shown when a recap is selected */}
        {activeRecap && (
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <button
                onClick={closeRecap}
                className="text-xs text-muted-foreground hover:text-foreground/60 transition-colors"
              >
                ← Back to list
              </button>
              <span className="text-xs text-muted-foreground/60">/</span>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-foreground/60 truncate max-w-xs">
                {activeRecap.name}
              </span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${SOURCE_BADGE[activeRecap.source].className}`}>
                {SOURCE_BADGE[activeRecap.source].label}
              </span>
            </div>
            <StealthCard hover={false} className="overflow-hidden">
              <iframe
                src={`/api/recaps/serve?file=${encodeURIComponent(activeRecap.path)}`}
                className="w-full border-0"
                style={{ minHeight: '80vh' }}
                sandbox="allow-scripts allow-same-origin"
                title={activeRecap.name}
                onLoad={(e) => {
                  const iframe = e.currentTarget
                  const resize = () => {
                    try {
                      const h = iframe.contentDocument?.documentElement?.scrollHeight
                      if (h) iframe.style.height = h + 32 + 'px'
                    } catch { /* cross-origin fallback */ }
                  }
                  resize()
                  setTimeout(resize, 500)
                }}
              />
            </StealthCard>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-sm border border-border bg-muted/30 h-12 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <StealthCard hover={false} className="p-8 text-center">
            <p className="text-sm text-red-400">Failed to load recaps</p>
            <p className="text-xs text-muted-foreground/75 mt-1">
              Check that ~/.agent/diagrams or ~/Shugyo/plans exists
            </p>
          </StealthCard>
        ) : groups.length === 0 ? (
          <StealthCard hover={false} className="p-12 text-center">
            <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-foreground mb-2">
              No recaps found
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              HTML files from agent sessions appear here. They&apos;re saved to{' '}
              <code className="font-[family-name:var(--font-jetbrains-mono)] text-[10px]">
                ~/.agent/diagrams/
              </code>{' '}
              or{' '}
              <code className="font-[family-name:var(--font-jetbrains-mono)] text-[10px]">
                ~/Shugyo/plans/
              </code>
            </p>
          </StealthCard>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map(group => {
              const isOpen = expandedDates.has(group.date)
              const isToday = group.date === today
              return (
                <div key={group.date} className="rounded-sm border border-border overflow-hidden">

                  {/* Date header — accordion trigger */}
                  <button
                    onClick={() => toggleDate(group.date)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/40 transition-colors text-left"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isToday ? 'bg-emerald-400' : 'bg-muted-foreground/40'}`} />
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-medium text-foreground flex-1">
                      {group.date}
                      {isToday && (
                        <span className="ml-2 text-[10px] text-emerald-400 font-normal">today</span>
                      )}
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground">
                      {group.recaps.length} {group.recaps.length === 1 ? 'recap' : 'recaps'}
                    </span>
                    <span className={`text-muted-foreground/60 text-sm transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                      ›
                    </span>
                  </button>

                  {/* Recap items */}
                  {isOpen && (
                    <div className="divide-y divide-border/50 bg-background">
                      {group.recaps.map((recap, idx) => {
                        const badge = SOURCE_BADGE[recap.source]
                        const isActive = activeRecap?.path === recap.path
                        return (
                          <button
                            key={idx}
                            onClick={() => openRecap(recap)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                              isActive
                                ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500'
                                : 'hover:bg-muted/30'
                            }`}
                          >
                            {/* Name */}
                            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-foreground flex-1 truncate">
                              {recap.name}
                            </span>

                            {/* Source badge */}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${badge.className}`}>
                              {badge.label}
                            </span>

                            {/* Size */}
                            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground shrink-0 w-14 text-right">
                              {formatBytes(recap.size)}
                            </span>

                            {/* Modified time */}
                            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground shrink-0 w-28 text-right">
                              {formatDate(recap.modified)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
