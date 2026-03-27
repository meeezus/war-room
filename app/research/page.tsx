"use client"

import { useState, useEffect, useCallback } from 'react'
import { SidebarNav } from '@/components/sidebar-nav'
import { Breadcrumb } from '@/components/breadcrumb'
import { StealthCard } from '@/components/stealth-card'
import type { ResearchFinding } from '@/lib/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCES = ['all', 'twitter', 'arxiv', 'autoresearch', 'brave', 'perplexity', 'manual'] as const
type SourceTab = typeof SOURCES[number]

const STATUS_TABS = ['all', 'new', 'reviewed', 'actionable', 'archived'] as const
type StatusTab = typeof STATUS_TABS[number]

const RELEVANCE_CONFIG = {
  high: { dot: 'bg-red-500', badge: 'bg-red-500/15 text-red-400', label: 'High' },
  medium: { dot: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-400', label: 'Medium' },
  low: { dot: 'bg-blue-500', badge: 'bg-blue-500/15 text-blue-400', label: 'Low' },
} as const

const SOURCE_BADGES: Record<string, { bg: string; label: string }> = {
  twitter: { bg: 'bg-sky-500/15 text-sky-400', label: 'Twitter' },
  arxiv: { bg: 'bg-orange-500/15 text-orange-400', label: 'arXiv' },
  autoresearch: { bg: 'bg-purple-500/15 text-purple-400', label: 'AutoRes' },
  brave: { bg: 'bg-orange-600/15 text-orange-300', label: 'Brave' },
  perplexity: { bg: 'bg-teal-500/15 text-teal-400', label: 'Perplexity' },
  manual: { bg: 'bg-zinc-500/15 text-zinc-400', label: 'Manual' },
  last30days: { bg: 'bg-indigo-500/15 text-indigo-400', label: '30 Days' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getSourceBadge(source: string) {
  return SOURCE_BADGES[source] ?? { bg: 'bg-zinc-500/15 text-zinc-400', label: source }
}

// ---------------------------------------------------------------------------
// Finding Row
// ---------------------------------------------------------------------------

interface RowProps {
  finding: ResearchFinding
  expanded: boolean
  onToggle: () => void
  onStatusChange: (id: string, status: string) => void
}

function FindingRow({ finding, expanded, onToggle, onStatusChange }: RowProps) {
  const rel = RELEVANCE_CONFIG[finding.relevance] ?? RELEVANCE_CONFIG.medium
  const src = getSourceBadge(finding.source)

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Source badge */}
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${src.bg}`}>
          {src.label}
        </span>

        {/* Title + summary */}
        <div className="flex-1 min-w-0">
          <p className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-foreground leading-snug truncate">
            {finding.title}
          </p>
          {finding.summary && !expanded && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{finding.summary}</p>
          )}
        </div>

        {/* Relevance */}
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium shrink-0 ${rel.badge} px-2 py-0.5 rounded-full`}>
          <span className={`w-1.5 h-1.5 rounded-full ${rel.dot}`} />
          {rel.label}
        </span>

        {/* Status */}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground shrink-0">
          {finding.status}
        </span>

        {/* Date */}
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground shrink-0 w-16 text-right">
          {timeAgo(finding.created_at)}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 ml-[68px] space-y-3">
          {finding.summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">{finding.summary}</p>
          )}
          {finding.url && (
            <a
              href={finding.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              {finding.url}
            </a>
          )}
          {finding.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {finding.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            {finding.status === 'new' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onStatusChange(finding.id, 'reviewed') }}
                  className="px-2.5 py-1 rounded-sm border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
                >
                  Mark Reviewed
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onStatusChange(finding.id, 'actionable') }}
                  className="px-2.5 py-1 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                >
                  Mark Actionable
                </button>
              </>
            )}
            {finding.status !== 'archived' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(finding.id, 'archived') }}
                className="px-2.5 py-1 rounded-sm border border-border bg-muted/40 text-muted-foreground text-xs font-medium hover:text-foreground hover:bg-muted transition-colors"
              >
                Archive
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ResearchPage() {
  const [findings, setFindings] = useState<ResearchFinding[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<SourceTab>('all')
  const [statusFilter, setStatusFilter] = useState<StatusTab>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchFindings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/research/findings?${params}`)
      if (res.ok) {
        const data = await res.json()
        setFindings(data.findings ?? [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchFindings() }, [fetchFindings])

  // Client-side source filter (API filters by status, we filter by source locally)
  const filteredFindings = sourceFilter === 'all'
    ? findings
    : findings.filter(f => f.source === sourceFilter)

  async function handleStatusChange(id: string, newStatus: string) {
    // Optimistic update
    setFindings(prev => prev.map(f => f.id === id ? { ...f, status: newStatus as ResearchFinding['status'] } : f))

    // TODO: call PATCH API when available
    // For now just a local state change
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />
      <main className="flex-1 p-6 overflow-auto">
        <Breadcrumb segments={[{ label: 'Tenshu', href: '/dashboard' }, { label: 'Research' }]} />

        <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-foreground mt-4 mb-6">
          Research Findings
        </h1>

        {/* Source filter tabs */}
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {SOURCES.map(source => (
            <button
              key={source}
              onClick={() => setSourceFilter(source)}
              className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                sourceFilter === source
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {source === 'all' ? 'All' : (SOURCE_BADGES[source]?.label ?? source)}
            </button>
          ))}
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 mb-6 flex-wrap">
          {STATUS_TABS.map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-muted text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Findings list */}
        <StealthCard>
          {loading ? (
            <div className="p-8">
              <div className="flex flex-col gap-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 rounded-sm bg-muted/30 animate-pulse" />
                ))}
              </div>
            </div>
          ) : filteredFindings.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground text-sm">No findings match the current filters</p>
            </div>
          ) : (
            <div>
              {filteredFindings.map(finding => (
                <FindingRow
                  key={finding.id}
                  finding={finding}
                  expanded={expandedId === finding.id}
                  onToggle={() => setExpandedId(prev => prev === finding.id ? null : finding.id)}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </StealthCard>

        {/* Count */}
        {!loading && (
          <p className="text-xs text-muted-foreground mt-3">
            {filteredFindings.length} finding{filteredFindings.length !== 1 ? 's' : ''}
            {sourceFilter !== 'all' && ` from ${sourceFilter}`}
            {statusFilter !== 'all' && ` with status "${statusFilter}"`}
          </p>
        )}
      </main>
    </div>
  )
}
