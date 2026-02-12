"use client"

import { useState } from 'react'
import type { Proposal } from '@/lib/types'
import { approveProposal, rejectProposal, DOMAIN_TO_DAIMYO } from '@/lib/queries'

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  medium: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  high: { bg: 'bg-red-500/15', text: 'text-red-400' },
}

interface ProposalKanbanCardProps {
  proposal: Proposal
  onApproved?: (proposalId: string) => void
  onRejected?: (proposalId: string) => void
}

export function ProposalKanbanCard({ proposal, onApproved, onRejected }: ProposalKanbanCardProps) {
  const [acting, setActing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [dispatchFeedback, setDispatchFeedback] = useState<string | null>(null)

  async function handleApprove() {
    setActing(true)
    try {
      const projectId = proposal.project_id || ''
      const result = await approveProposal(proposal.id, projectId)
      if (result && result.missionPending) {
        const daimyoId = result.daimyo || DOMAIN_TO_DAIMYO[proposal.domain ?? ''] || 'ed'
        const daimyoName = daimyoId.charAt(0).toUpperCase() + daimyoId.slice(1)
        setDispatchFeedback(`Mission queued for ${daimyoName}`)
        setTimeout(() => {
          setDispatchFeedback(null)
          onApproved?.(proposal.id)
        }, 2000)
      } else if (result) {
        onApproved?.(proposal.id)
      }
    } catch (err) {
      console.error('Approve failed:', err)
    } finally {
      setActing(false)
    }
  }

  async function handleReject() {
    setActing(true)
    try {
      await rejectProposal(proposal.id)
      onRejected?.(proposal.id)
    } catch (err) {
      console.error('Reject failed:', err)
    } finally {
      setActing(false)
    }
  }

  const risk = proposal.risk_level ? RISK_COLORS[proposal.risk_level] : null

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      {/* Title + actions */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-pretty line-clamp-2 font-[family-name:var(--font-space-grotesk)]">
          {proposal.title}
        </p>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={handleApprove}
            disabled={acting}
            className="rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
            aria-label="Approve proposal"
          >
            Approve
          </button>
          <button
            onClick={handleReject}
            disabled={acting}
            className="rounded bg-red-500/15 px-2 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
            aria-label="Reject proposal"
          >
            Reject
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40">
          {proposal.source}
        </span>
        {proposal.domain && (
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40">
            {proposal.domain}
          </span>
        )}
        {risk && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${risk.bg} ${risk.text}`}>
            {proposal.risk_level}
          </span>
        )}
        {proposal.council_review && (
          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
            Council
          </span>
        )}
        <span className="text-[10px] text-[rgba(255,255,255,0.3)]">
          by {proposal.requested_by}
        </span>
      </div>

      {/* Expandable description */}
      {proposal.description && (
        <div className="mt-2">
          {expanded ? (
            <>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-[rgba(255,255,255,0.5)] text-pretty">
                {proposal.description}
              </p>
              <button
                onClick={() => setExpanded(false)}
                className="mt-1 text-[10px] text-white/30 hover:text-white/50"
              >
                Show less
              </button>
            </>
          ) : (
            <button
              onClick={() => setExpanded(true)}
              className="text-[10px] text-white/30 hover:text-white/50"
            >
              {proposal.description.length > 80
                ? `${proposal.description.slice(0, 80)}... Show more`
                : proposal.description}
            </button>
          )}
        </div>
      )}

      {/* Reviews */}
      {proposal.reviews && proposal.reviews.length > 0 && (
        <div className="mt-2 space-y-1">
          {proposal.reviews.map((review, i) => {
            const verdictColor = review.verdict === 'approve' ? 'text-emerald-400' : review.verdict === 'concern' ? 'text-amber-400' : 'text-red-400'
            return (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className="text-[rgba(255,255,255,0.4)]">{review.agent}</span>
                <span className={verdictColor}>{review.verdict}</span>
                {review.note && <span className="text-[rgba(255,255,255,0.3)]">{review.note}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Dispatch feedback */}
      {dispatchFeedback && (
        <div className="mt-2 rounded bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
          {dispatchFeedback}
        </div>
      )}
    </div>
  )
}
