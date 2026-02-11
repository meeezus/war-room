"use client";

import { useState } from "react";
import type { Proposal } from "@/lib/types";
import { approveProposal, rejectProposal, DOMAIN_TO_DAIMYO } from "@/lib/queries";
import { StealthCard } from "./stealth-card";

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  medium: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  high: { bg: "bg-red-500/15", text: "text-red-400" },
};

interface ProposalsSectionProps {
  proposals: Proposal[];
  projectId: string;
  onUpdate?: () => void;
}

export function ProposalsSection({ proposals, projectId, onUpdate }: ProposalsSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [localProposals, setLocalProposals] = useState(proposals);
  const [acting, setActing] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ proposalId: string; existingTitle: string } | null>(null);
  const [dispatchFeedback, setDispatchFeedback] = useState<{ proposalId: string; daimyo: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (localProposals.length === 0) return null;

  async function proceedApprove(proposalId: string) {
    setDuplicateWarning(null);
    setActing(proposalId);
    const proposal = localProposals.find(p => p.id === proposalId);
    const result = await approveProposal(proposalId, projectId);
    if (result && result.missionPending) {
      const daimyoId = result.daimyo || DOMAIN_TO_DAIMYO[proposal?.domain ?? ''] || 'ed';
      const daimyoName = daimyoId.charAt(0).toUpperCase() + daimyoId.slice(1);
      setDispatchFeedback({ proposalId, daimyo: daimyoName });
      // Flash for 2 seconds then remove the card
      setTimeout(() => {
        setDispatchFeedback(null);
        setLocalProposals((prev) => prev.filter((p) => p.id !== proposalId));
      }, 2000);
    } else {
      setLocalProposals((prev) => prev.filter((p) => p.id !== proposalId));
    }
    setActing(null);
    onUpdate?.();
  }

  async function handleApprove(proposalId: string) {
    const proposal = localProposals.find(p => p.id === proposalId);
    if (!proposal) return;

    if (!duplicateWarning || duplicateWarning.proposalId !== proposalId) {
      const { supabase } = await import("@/lib/supabase");
      if (supabase) {
        const { data: existingTasks } = await supabase
          .from("tasks")
          .select("title")
          .eq("project_id", projectId);

        const match = (existingTasks || []).find((t: { title: string }) =>
          t.title.toLowerCase().includes(proposal.title.toLowerCase()) ||
          proposal.title.toLowerCase().includes(t.title.toLowerCase())
        );

        if (match) {
          setDuplicateWarning({ proposalId, existingTitle: match.title });
          return;
        }
      }
    }

    await proceedApprove(proposalId);
  }

  async function handleReject(proposalId: string) {
    setActing(proposalId);
    await rejectProposal(proposalId);
    setLocalProposals((prev) => prev.filter((p) => p.id !== proposalId));
    setActing(null);
    onUpdate?.();
  }

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-2 flex items-center gap-2"
      >
        <span
          className="text-xs text-[rgba(255,255,255,0.3)] transition-transform duration-150"
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0)" }}
        >
          ▾
        </span>
        <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
          Proposals
        </span>
        <span className="inline-flex size-5 items-center justify-center rounded bg-amber-500/15 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium text-amber-400">
          {localProposals.length}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {localProposals.map((proposal) => {
            const risk = proposal.risk_level ? RISK_COLORS[proposal.risk_level] : null;
            return (
              <StealthCard key={proposal.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-[#E5E5E5]">
                      {proposal.title}
                    </h4>
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
                          Awaiting Council
                        </span>
                      )}
                      <span className="text-[10px] text-[rgba(255,255,255,0.3)]">
                        by {proposal.requested_by}
                      </span>
                    </div>
                    {proposal.description && (
                      <div className="mt-2">
                        {expandedId === proposal.id ? (
                          <>
                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-[rgba(255,255,255,0.5)]">
                              {proposal.description}
                            </p>
                            <button
                              onClick={() => setExpandedId(null)}
                              className="mt-1 text-[10px] text-white/30 hover:text-white/50"
                            >
                              Show less
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setExpandedId(proposal.id)}
                            className="text-[10px] text-white/30 hover:text-white/50"
                          >
                            {proposal.description.length > 80
                              ? `${proposal.description.slice(0, 80)}... Show more`
                              : proposal.description}
                          </button>
                        )}
                      </div>
                    )}
                    {proposal.reviews && proposal.reviews.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {proposal.reviews.map((review, i) => {
                          const verdictColor = review.verdict === 'approve' ? 'text-emerald-400' : review.verdict === 'concern' ? 'text-amber-400' : 'text-red-400';
                          return (
                            <div key={i} className="flex items-center gap-2 text-[10px]">
                              <span className="text-[rgba(255,255,255,0.4)]">{review.agent}</span>
                              <span className={verdictColor}>{review.verdict}</span>
                              {review.note && <span className="text-[rgba(255,255,255,0.3)]">{review.note}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => handleApprove(proposal.id)}
                      disabled={acting === proposal.id}
                      className="rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(proposal.id)}
                      disabled={acting === proposal.id}
                      className="rounded bg-red-500/15 px-2 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
                {duplicateWarning?.proposalId === proposal.id && (
                  <div className="mt-2 rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    Similar task exists: &ldquo;{duplicateWarning.existingTitle}&rdquo;
                    <div className="mt-1 flex gap-2">
                      <button onClick={() => proceedApprove(proposal.id)} className="text-emerald-400 hover:text-emerald-300">
                        Proceed anyway
                      </button>
                      <button onClick={() => setDuplicateWarning(null)} className="text-[rgba(255,255,255,0.4)] hover:text-[#E5E5E5]">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {dispatchFeedback?.proposalId === proposal.id && (
                  <div className="mt-2 rounded bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
                    Mission queued for {dispatchFeedback.daimyo}
                  </div>
                )}
              </StealthCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
