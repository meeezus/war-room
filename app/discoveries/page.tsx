"use client"

import { useState, useEffect, useCallback } from 'react'
import { Breadcrumb } from '@/components/breadcrumb'
import type { Discovery } from '@/lib/types'

const SEVERITY_CONFIG = {
  critical: { color: 'bg-red-500', textColor: 'text-red-400', label: 'Critical', dotColor: 'bg-red-500' },
  warning: { color: 'bg-amber-500', textColor: 'text-amber-400', label: 'Warning', dotColor: 'bg-amber-500' },
  info: { color: 'bg-blue-500', textColor: 'text-blue-400', label: 'Info', dotColor: 'bg-blue-500' },
} as const

const CATEGORY_LABELS: Record<Discovery['category'], string> = {
  code_health: 'Code Health',
  dependency: 'Dependency',
  performance: 'Performance',
  cost: 'Cost',
  opportunity: 'Opportunity',
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function DiscoveriesPage() {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'dismissed'>('pending')
  const [severityFilters, setSeverityFilters] = useState<Set<string>>(new Set(['critical', 'warning', 'info']))
  const [loading, setLoading] = useState(true)

  const fetchDiscoveries = useCallback(async () => {
    setLoading(true)
    try {
      const severityParam = Array.from(severityFilters).join(',')
      const res = await fetch(`/api/discoveries?status=${statusFilter}&severity=${severityParam}`)
      if (res.ok) {
        const data = await res.json()
        setDiscoveries(data)
      }
    } catch {
      // silently fail, leave list empty
    } finally {
      setLoading(false)
    }
  }, [statusFilter, severityFilters])

  useEffect(() => {
    fetchDiscoveries()
  }, [fetchDiscoveries])

  async function handleAction(discoveryId: string, action: 'approve' | 'dismiss') {
    setDiscoveries(prev => prev.filter(d => d.id !== discoveryId))
    try {
      await fetch('/api/brief/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discovery_id: discoveryId, action }),
      })
    } catch {
      fetchDiscoveries()
    }
  }

  function toggleSeverity(severity: string) {
    setSeverityFilters(prev => {
      const next = new Set(prev)
      if (next.has(severity)) {
        next.delete(severity)
      } else {
        next.add(severity)
      }
      return next
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Breadcrumb segments={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Discoveries' },
          ]} className="mb-4" />
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground">
            Discoveries
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Patrol findings from automated code scans
          </p>
        </div>

        {/* Filter bar */}
        <div className="mb-6 flex flex-wrap items-center gap-4">

          {/* Status tabs */}
          <div className="flex items-center gap-1">
            {(['pending', 'approved', 'dismissed'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                  statusFilter === status
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Severity toggles */}
          <div className="flex items-center gap-2">
            {(['critical', 'warning', 'info'] as const).map(severity => {
              const cfg = SEVERITY_CONFIG[severity]
              const active = severityFilters.has(severity)
              return (
                <button
                  key={severity}
                  onClick={() => toggleSeverity(severity)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    active
                      ? `border-transparent ${cfg.color.replace('bg-', 'bg-').replace('500', '500/20')} ${cfg.textColor}`
                      : 'border-border text-muted-foreground bg-transparent'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${active ? cfg.dotColor : 'bg-muted-foreground'}`} />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Discovery list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-sm border border-border bg-muted/30 h-24 animate-pulse" />
            ))}
          </div>
        ) : discoveries.length === 0 ? (
          <div className="rounded-sm border border-border bg-muted/20 p-12 text-center">
            <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-foreground mb-2">
              No discoveries found
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Patrol scans repos nightly at 11 PM. Findings appear here for review.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {discoveries.map(discovery => {
              const sev = SEVERITY_CONFIG[discovery.severity]
              return (
                <div
                  key={discovery.id}
                  className="rounded-sm border border-border bg-card backdrop-blur-xl p-4"
                >
                  <div className="flex items-start gap-3">

                    {/* Severity dot */}
                    <div className="mt-1 shrink-0">
                      <span className={`block w-2 h-2 rounded-full ${sev.dotColor}`} />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-foreground">
                          {discovery.title}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sev.color.replace('bg-', 'bg-').replace('500', '500/15')} ${sev.textColor}`}>
                          {CATEGORY_LABELS[discovery.category]}
                        </span>
                        {discovery.repo && (
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
                            {discovery.repo}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {discovery.description}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/75">
                        <span className="font-[family-name:var(--font-jetbrains-mono)]">
                          {discovery.agent_id}
                        </span>
                        <span>·</span>
                        <span>{timeAgo(discovery.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions (pending only) */}
                    {discovery.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0 mt-0.5">
                        <button
                          onClick={() => handleAction(discovery.id, 'approve')}
                          className="px-2.5 py-1 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                        >
                          Approve ✓
                        </button>
                        <button
                          onClick={() => handleAction(discovery.id, 'dismiss')}
                          className="px-2.5 py-1 rounded-sm border border-border bg-muted/40 text-muted-foreground text-xs font-medium hover:text-foreground hover:bg-muted transition-colors"
                        >
                          Dismiss ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
