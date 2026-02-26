"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { Breadcrumb } from '@/components/breadcrumb'
import { StealthCard } from '@/components/stealth-card'
import type { Discovery } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RepoCounts {
  repo: string
  critical: number
  warning: number
  info: number
  total: number
}

interface FetchResult {
  discoveries: Discovery[]
  total: number
  page: number
  limit: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20

const SEVERITY_CONFIG = {
  critical: {
    textColor: 'text-red-500',
    bgActive: 'bg-red-500/15 border-red-500/30 text-red-400',
    dot: 'bg-red-500',
    badge: 'bg-red-500/15 text-red-400',
    label: 'Critical',
  },
  warning: {
    textColor: 'text-amber-500',
    bgActive: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/15 text-amber-400',
    label: 'Warning',
  },
  info: {
    textColor: 'text-blue-500',
    bgActive: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/15 text-blue-400',
    label: 'Info',
  },
} as const

const STATUS_TABS = ['pending', 'approved', 'dismissed'] as const
type StatusTab = typeof STATUS_TABS[number]

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

function shortRepoName(repo: string): string {
  return repo.replace(/^(github\.com\/)?[\w-]+\//, '')
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

interface SidebarProps {
  repos: RepoCounts[]
  selectedRepo: string
  onSelect: (repo: string) => void
  loading: boolean
}

function RepoBadge({ count, color }: { count: number; color: string }) {
  if (count === 0) return null
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-[family-name:var(--font-jetbrains-mono)] font-medium leading-none ${color}`}>
      {count}
    </span>
  )
}

function Sidebar({ repos, selectedRepo, onSelect, loading }: SidebarProps) {
  const totalCounts = repos.reduce(
    (acc, r) => ({ critical: acc.critical + r.critical, warning: acc.warning + r.warning, info: acc.info + r.info }),
    { critical: 0, warning: 0, info: 0 }
  )

  return (
    <aside className="w-64 shrink-0 flex flex-col gap-1">
      <p className="font-[family-name:var(--font-space-grotesk)] text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-2">
        Repositories
      </p>

      {/* All Repos */}
      <button
        onClick={() => onSelect('all')}
        className={`flex items-center justify-between w-full rounded-sm px-3 py-2 text-left transition-colors ${
          selectedRepo === 'all'
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium">All Repos</span>
        <div className="flex items-center gap-1">
          <RepoBadge count={totalCounts.critical} color="bg-red-500/15 text-red-400" />
          <RepoBadge count={totalCounts.warning} color="bg-amber-500/15 text-amber-400" />
          <RepoBadge count={totalCounts.info} color="bg-blue-500/15 text-blue-400" />
        </div>
      </button>

      {/* Repo list */}
      {loading ? (
        <div className="flex flex-col gap-1 mt-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 rounded-sm bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : repos.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground/50">No repos found</p>
      ) : (
        repos.map(r => (
          <button
            key={r.repo}
            onClick={() => onSelect(r.repo)}
            className={`flex items-center justify-between w-full rounded-sm px-3 py-2 text-left transition-colors ${
              selectedRepo === r.repo
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] truncate max-w-[130px]">
              {shortRepoName(r.repo)}
            </span>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              <RepoBadge count={r.critical} color="bg-red-500/15 text-red-400" />
              <RepoBadge count={r.warning} color="bg-amber-500/15 text-amber-400" />
              <RepoBadge count={r.info} color="bg-blue-500/15 text-blue-400" />
            </div>
          </button>
        ))
      )}
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Table row
// ---------------------------------------------------------------------------

interface RowProps {
  discovery: Discovery
  onAction: (id: string, action: 'approve' | 'dismiss') => void
  showActions: boolean
}

function DiscoveryRow({ discovery, onAction, showActions }: RowProps) {
  const sev = SEVERITY_CONFIG[discovery.severity]

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
      {/* Severity */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${sev.textColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sev.dot}`} />
          {sev.label}
        </span>
      </td>

      {/* Title */}
      <td className="px-4 py-3">
        <p className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-foreground leading-snug">
          {discovery.title}
        </p>
        {discovery.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{discovery.description}</p>
        )}
      </td>

      {/* Repo */}
      <td className="px-4 py-3 whitespace-nowrap">
        {discovery.repo ? (
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
            {shortRepoName(discovery.repo)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </td>

      {/* Agent */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
          {discovery.agent_id}
        </span>
      </td>

      {/* Date */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
          {timeAgo(discovery.created_at)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap">
        {showActions ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAction(discovery.id, 'approve')}
              className="px-2.5 py-1 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onAction(discovery.id, 'dismiss')}
              className="px-2.5 py-1 rounded-sm border border-border bg-muted/40 text-muted-foreground text-xs font-medium hover:text-foreground hover:bg-muted transition-colors"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${sev.badge}`}>
            {discovery.status}
          </span>
        )}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DiscoveriesPage() {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [repos, setRepos] = useState<RepoCounts[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const [statusFilter, setStatusFilter] = useState<StatusTab>('pending')
  const [severityFilters, setSeverityFilters] = useState<Set<string>>(new Set(['critical', 'warning', 'info']))
  const [selectedRepo, setSelectedRepo] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [loadingData, setLoadingData] = useState(true)
  const [loadingRepos, setLoadingRepos] = useState(true)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchQuery])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, severityFilters, selectedRepo])

  // Fetch repo sidebar counts
  const fetchRepos = useCallback(async () => {
    setLoadingRepos(true)
    try {
      const res = await fetch('/api/discoveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusFilter }),
      })
      if (res.ok) {
        const data = await res.json()
        setRepos(data.repos ?? [])
      }
    } catch {
      // silently fail
    } finally {
      setLoadingRepos(false)
    }
  }, [statusFilter])

  // Fetch discoveries table data
  const fetchDiscoveries = useCallback(async () => {
    setLoadingData(true)
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        severity: Array.from(severityFilters).join(','),
        page: String(page),
        limit: String(PAGE_SIZE),
      })
      if (selectedRepo !== 'all') params.set('repo', selectedRepo)
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/discoveries?${params}`)
      if (res.ok) {
        const data: FetchResult = await res.json()
        setDiscoveries(data.discoveries ?? [])
        setTotal(data.total ?? 0)
      }
    } catch {
      // silently fail
    } finally {
      setLoadingData(false)
    }
  }, [statusFilter, severityFilters, selectedRepo, debouncedSearch, page])

  useEffect(() => { fetchRepos() }, [fetchRepos])
  useEffect(() => { fetchDiscoveries() }, [fetchDiscoveries])

  async function handleAction(discoveryId: string, action: 'approve' | 'dismiss') {
    // Optimistic remove from list
    setDiscoveries(prev => prev.filter(d => d.id !== discoveryId))
    setTotal(prev => Math.max(0, prev - 1))

    try {
      await fetch('/api/brief/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discovery_id: discoveryId, action }),
      })
    } catch {
      // Refetch on error
      fetchDiscoveries()
    }
    // Refresh repo counts after action
    fetchRepos()
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

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="p-6 md:p-10">

        {/* Header */}
        <div className="mb-8">
          <Breadcrumb segments={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Discoveries' },
          ]} className="mb-4" />
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground">
            Discovery Browser
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Patrol findings from automated code scans
          </p>
        </div>

        {/* Layout: sidebar + main */}
        <div className="flex gap-6">

          {/* Left sidebar */}
          <Sidebar
            repos={repos}
            selectedRepo={selectedRepo}
            onSelect={(repo) => setSelectedRepo(repo)}
            loading={loadingRepos}
          />

          {/* Main content */}
          <div className="flex-1 min-w-0">

            {/* Status tabs + severity toggles + search */}
            <div className="flex flex-wrap items-center gap-3 mb-5">

              {/* Status tabs */}
              <div className="flex items-center gap-1 rounded-sm border border-border bg-muted/30 p-0.5">
                {STATUS_TABS.map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 rounded-[3px] text-xs font-medium capitalize transition-colors font-[family-name:var(--font-space-grotesk)] ${
                      statusFilter === status
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Severity toggles */}
              <div className="flex items-center gap-1.5">
                {(['critical', 'warning', 'info'] as const).map(severity => {
                  const cfg = SEVERITY_CONFIG[severity]
                  const active = severityFilters.has(severity)
                  return (
                    <button
                      key={severity}
                      onClick={() => toggleSeverity(severity)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors border font-[family-name:var(--font-space-grotesk)] ${
                        active ? cfg.bgActive : 'border-border text-muted-foreground bg-transparent hover:text-foreground'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? cfg.dot : 'bg-muted-foreground'}`} />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>

              {/* Search */}
              <div className="ml-auto flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search discoveries..."
                  className="h-8 w-52 rounded-sm border border-border bg-muted/30 px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-border font-[family-name:var(--font-space-grotesk)]"
                />
              </div>
            </div>

            {/* Table */}
            <StealthCard hover={false} className="overflow-hidden">
              {loadingData ? (
                <div className="flex flex-col">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-14 border-b border-border last:border-0 animate-pulse bg-muted/20" />
                  ))}
                </div>
              ) : discoveries.length === 0 ? (
                <div className="p-16 text-center">
                  <p className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-foreground mb-2">
                    No discoveries found
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    {debouncedSearch
                      ? `No results for "${debouncedSearch}"`
                      : 'Patrol scans repos nightly. Findings appear here for review.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-[family-name:var(--font-space-grotesk)] font-medium w-24">
                          Severity
                        </th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-[family-name:var(--font-space-grotesk)] font-medium">
                          Discovery Title
                        </th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-[family-name:var(--font-space-grotesk)] font-medium w-32">
                          Repo
                        </th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-[family-name:var(--font-space-grotesk)] font-medium w-28">
                          Agent
                        </th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-[family-name:var(--font-space-grotesk)] font-medium w-24">
                          Date
                        </th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-[family-name:var(--font-space-grotesk)] font-medium w-36">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {discoveries.map(d => (
                        <DiscoveryRow
                          key={d.id}
                          discovery={d}
                          onAction={handleAction}
                          showActions={statusFilter === 'pending'}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </StealthCard>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-sm border border-border bg-muted/30 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-[family-name:var(--font-space-grotesk)]"
                  >
                    Previous
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p = i + 1
                    if (totalPages > 5) {
                      if (page <= 3) p = i + 1
                      else if (page >= totalPages - 2) p = totalPages - 4 + i
                      else p = page - 2 + i
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-sm text-xs transition-colors font-[family-name:var(--font-jetbrains-mono)] ${
                          p === page
                            ? 'bg-foreground text-background font-semibold'
                            : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  })}

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-sm border border-border bg-muted/30 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-[family-name:var(--font-space-grotesk)]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
