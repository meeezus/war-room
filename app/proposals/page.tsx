"use client"

import { useState, useEffect, useCallback } from 'react'
import { Breadcrumb } from '@/components/breadcrumb'
import { StealthCard } from '@/components/stealth-card'
import type { Proposal } from '@/lib/types'
import { approveProposal, rejectProposal, DOMAIN_TO_DAIMYO } from '@/lib/queries'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_STEPS = ['scope', 'research', 'brd', 'prd', 'trd', 'build', 'review', 'ship'] as const

const PHASE_COLORS: Record<string, string> = {
  scope:    'text-slate-400 bg-slate-500/15',
  research: 'text-blue-400 bg-blue-500/15',
  brd:      'text-purple-400 bg-purple-500/15',
  prd:      'text-purple-400 bg-purple-500/15',
  trd:      'text-purple-400 bg-purple-500/15',
  build:    'text-amber-400 bg-amber-500/15',
  review:   'text-orange-400 bg-orange-500/15',
  ship:     'text-emerald-400 bg-emerald-500/15',
}

const STATUS_CONFIG = {
  pending: { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-500', label: 'Pending' },
  approved: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-500', label: 'Approved' },
  rejected: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-500', label: 'Rejected' },
  completed: { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-500', label: 'Completed' },
  failed: { bg: 'bg-red-500/15', text: 'text-red-300', dot: 'bg-red-400', label: 'Failed' },
} as const

const DOMAIN_COLORS: Record<string, string> = {
  engineering: 'text-blue-400 bg-blue-500/15',
  product: 'text-purple-400 bg-purple-500/15',
  commerce: 'text-amber-400 bg-amber-500/15',
  influence: 'text-pink-400 bg-pink-500/15',
  operations: 'text-red-400 bg-red-500/15',
  coordination: 'text-cyan-400 bg-cyan-500/15',
}

const SOURCE_COLORS: Record<string, string> = {
  discord: 'text-indigo-400 bg-indigo-500/15',
  cron: 'text-slate-400 bg-slate-500/15',
  trigger: 'text-orange-400 bg-orange-500/15',
  manual: 'text-emerald-400 bg-emerald-500/15',
  patrol: 'text-yellow-400 bg-yellow-500/15',
  awareness: 'text-purple-400 bg-purple-500/15',
  reflexive: 'text-cyan-400 bg-cyan-500/15',
  shoin_chat: 'text-blue-400 bg-blue-500/15',
}

type SortField = 'created_at' | 'status' | 'domain' | 'phase' | 'source'
type SortDir = 'asc' | 'desc'

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

function sortProposals(proposals: Proposal[], field: SortField, dir: SortDir): Proposal[] {
  const copy = [...proposals]
  const mult = dir === 'asc' ? 1 : -1
  copy.sort((a, b) => {
    const av = a[field] ?? ''
    const bv = b[field] ?? ''
    if (av < bv) return -1 * mult
    if (av > bv) return 1 * mult
    return 0
  })
  return copy
}

// ---------------------------------------------------------------------------
// Phase progress indicator
// ---------------------------------------------------------------------------

function PhaseIndicator({ phase }: { phase: Proposal['phase'] }) {
  if (!phase) return <span className="text-[10px] text-muted-foreground/50">--</span>

  const currentIdx = PHASE_STEPS.indexOf(phase)

  return (
    <div className="flex items-center gap-0.5">
      {PHASE_STEPS.map((step, i) => {
        const isActive = i === currentIdx
        const isDone = i < currentIdx
        return (
          <div
            key={step}
            title={step}
            className={`h-1.5 w-3 rounded-[1px] transition-colors ${
              isActive
                ? 'bg-amber-400'
                : isDone
                  ? 'bg-emerald-500/60'
                  : 'bg-muted-foreground/20'
            }`}
          />
        )
      })}
      <span className="ml-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
        {phase}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [domainFilter, setDomainFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState<string | null>(null)

  // Fetch proposals from API
  const fetchProposals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/proposals/list?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setProposals(data.proposals || [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  // Actions
  async function handleApprove(proposalId: string) {
    setActing(proposalId)
    // Approve with no project (user can route later)
    const result = await approveProposal(proposalId, '')
    if (result) {
      setProposals(prev => prev.map(p =>
        p.id === proposalId ? { ...p, status: 'approved' as const } : p
      ))
    }
    setActing(null)
  }

  async function handleAdvancePhase(proposalId: string) {
    setAdvancing(proposalId)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/advance`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setProposals(prev => prev.map(p =>
          p.id === proposalId ? { ...p, phase: data.proposal.phase } : p
        ))
      }
    } catch {
      // silently fail
    } finally {
      setAdvancing(null)
    }
  }

  async function handleReject(proposalId: string) {
    setActing(proposalId)
    await rejectProposal(proposalId)
    setProposals(prev => prev.map(p =>
      p.id === proposalId ? { ...p, status: 'rejected' as const } : p
    ))
    setActing(null)
  }

  // Sort toggle
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Filter + sort
  const filtered = proposals.filter(p => {
    if (domainFilter !== 'all' && p.domain !== domainFilter) return false
    if (sourceFilter !== 'all' && p.source !== sourceFilter) return false
    return true
  })

  const sorted = sortProposals(filtered, sortField, sortDir)

  // Unique domains and sources for filter dropdowns
  const domains = [...new Set(proposals.map(p => p.domain).filter(Boolean))] as string[]
  const sources = [...new Set(proposals.map(p => p.source).filter(Boolean))] as string[]

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Breadcrumb segments={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Proposals' },
          ]} className="mb-4" />
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground">
            Proposals
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review, approve, or reject incoming proposals from agents and triggers
          </p>
        </div>

        {/* Filter bar */}
        <div className="mb-6 flex flex-wrap items-center gap-4">

          {/* Status tabs */}
          <div className="flex items-center gap-1">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(status => (
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

          {/* Domain filter */}
          {domains.length > 0 && (
            <select
              value={domainFilter}
              onChange={e => setDomainFilter(e.target.value)}
              className="rounded-sm border border-border bg-card px-2 py-1 text-xs text-foreground"
            >
              <option value="all">All domains</option>
              {domains.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          {/* Source filter */}
          {sources.length > 0 && (
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="rounded-sm border border-border bg-card px-2 py-1 text-xs text-foreground"
            >
              <option value="all">All sources</option>
              {sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>

        {/* Sort controls */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sort:</span>
          {(['created_at', 'status', 'domain', 'phase', 'source'] as SortField[]).map(field => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`text-xs transition-colors ${
                sortField === field
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {field === 'created_at' ? 'date' : field}
              {sortField === field && (
                <span className="ml-0.5">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
              )}
            </button>
          ))}
          <span className="ml-auto font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/75">
            {sorted.length} proposal{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Proposal list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-sm border border-border bg-muted/30 h-20 animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-sm border border-border bg-muted/20 p-12 text-center">
            <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-foreground mb-2">
              No proposals found
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {statusFilter !== 'all'
                ? `No ${statusFilter} proposals. Try a different filter.`
                : 'Proposals appear here when created by agents, triggers, or chat.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map(proposal => {
              const statusCfg = STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG.pending
              const isExpanded = expandedId === proposal.id
              const isActing = acting === proposal.id
              const isAdvancing = advancing === proposal.id

              return (
                <StealthCard key={proposal.id} className="p-0 overflow-hidden">
                  {/* Main row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : proposal.id)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3"
                  >
                    {/* Status dot */}
                    <div className="mt-1.5 shrink-0">
                      <span className={`block w-2 h-2 rounded-full ${statusCfg.dot}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-foreground">
                          {proposal.title}
                        </span>

                        {/* Domain badge */}
                        {proposal.domain && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${DOMAIN_COLORS[proposal.domain] || 'text-muted-foreground bg-muted'}`}>
                            {proposal.domain}
                          </span>
                        )}

                        {/* Source badge */}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SOURCE_COLORS[proposal.source] || 'text-muted-foreground bg-muted'}`}>
                          {proposal.source}
                        </span>

                        {/* Status badge */}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                          {statusCfg.label}
                        </span>
                      </div>

                      {/* Phase indicator */}
                      <div className="mb-1">
                        <PhaseIndicator phase={proposal.phase} />
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/75">
                        <span className="font-[family-name:var(--font-jetbrains-mono)]">
                          {proposal.requested_by}
                        </span>
                        <span>.</span>
                        <span>{timeAgo(proposal.created_at)}</span>
                        {proposal.risk_level && (
                          <>
                            <span>.</span>
                            <span className={
                              proposal.risk_level === 'high' ? 'text-red-400'
                              : proposal.risk_level === 'medium' ? 'text-amber-400'
                              : 'text-emerald-400'
                            }>
                              {proposal.risk_level} risk
                            </span>
                          </>
                        )}
                        {proposal.cost_estimate != null && (
                          <>
                            <span>.</span>
                            <span className="font-[family-name:var(--font-jetbrains-mono)]">
                              ${proposal.cost_estimate.toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (pending only) */}
                    {proposal.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleApprove(proposal.id)}
                          disabled={isActing}
                          className="px-2.5 py-1 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(proposal.id)}
                          disabled={isActing}
                          className="px-2.5 py-1 rounded-sm border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Expand indicator */}
                    <span
                      className="text-xs text-muted-foreground/50 mt-1.5 shrink-0 transition-transform duration-150"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}
                    >
                      &#9662;
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 bg-muted/10">
                      {proposal.description ? (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {proposal.description}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 italic">
                          No description provided
                        </p>
                      )}

                      {/* Council reviews */}
                      {proposal.reviews && proposal.reviews.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <span className="font-[family-name:var(--font-space-grotesk)] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Council Reviews
                          </span>
                          {proposal.reviews.map((review, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className={`font-medium ${
                                review.verdict === 'approve' ? 'text-emerald-400'
                                : review.verdict === 'reject' ? 'text-red-400'
                                : 'text-amber-400'
                              }`}>
                                {review.agent}
                              </span>
                              <span className="text-muted-foreground">{review.note}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Phase progress detail */}
                      {proposal.phase && (
                        <div className="mt-3">
                          <span className="font-[family-name:var(--font-space-grotesk)] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Pipeline Progress
                          </span>
                          <div className="mt-1.5 flex items-center gap-1">
                            {PHASE_STEPS.map((step, i) => {
                              const currentIdx = PHASE_STEPS.indexOf(proposal.phase!)
                              const isActive = i === currentIdx
                              const isDone = i < currentIdx
                              return (
                                <div key={step} className="flex flex-col items-center gap-0.5">
                                  <div
                                    className={`h-2 w-6 rounded-[2px] ${
                                      isActive
                                        ? 'bg-amber-400'
                                        : isDone
                                          ? 'bg-emerald-500'
                                          : 'bg-muted-foreground/20'
                                    }`}
                                  />
                                  <span className={`text-[8px] ${isActive ? 'text-amber-400 font-medium' : 'text-muted-foreground/50'}`}>
                                    {step}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Advance Phase action */}
                      <div className="mt-3 flex items-center gap-2">
                        {proposal.phase && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PHASE_COLORS[proposal.phase] || 'text-muted-foreground bg-muted'}`}>
                            {proposal.phase}
                          </span>
                        )}
                        <button
                          onClick={() => handleAdvancePhase(proposal.id)}
                          disabled={isAdvancing || proposal.phase === 'ship'}
                          className="px-2.5 py-1 rounded-sm border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isAdvancing
                            ? 'Advancing...'
                            : proposal.phase === 'ship'
                              ? 'Final phase'
                              : `\u2192 ${
                                  proposal.phase
                                    ? PHASE_STEPS[PHASE_STEPS.indexOf(proposal.phase) + 1]
                                    : 'scope'
                                }`}
                        </button>
                      </div>

                      {/* Metadata: time_estimate, auto_approved */}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground/75">
                        {proposal.time_estimate && (
                          <span>Est: {proposal.time_estimate}</span>
                        )}
                        {proposal.auto_approved && (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-400">
                            auto-approved
                          </span>
                        )}
                        {proposal.council_review && (
                          <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-purple-400">
                            council-reviewed
                          </span>
                        )}
                        <span className="font-[family-name:var(--font-jetbrains-mono)]">
                          id: {proposal.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  )}
                </StealthCard>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
