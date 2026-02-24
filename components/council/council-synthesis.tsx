import Image from "next/image";
import type { CouncilSession } from "@/lib/types";

interface CouncilSynthesisProps {
  session: Pick<CouncilSession, "synthesis" | "recommendation" | "dissent">;
  onAccept?: () => void;
  onReject?: () => void;
  onIterate?: () => void;
}

export function CouncilSynthesis({ session, onAccept, onReject, onIterate }: CouncilSynthesisProps) {
  if (!session.synthesis && !session.recommendation) return null;

  return (
    <div className="mb-8">
      {/* Makima synthesis — distinct full-width block */}
      <div className="border-l-2 border-[#ef4444] pl-4 py-2">
        <div className="flex items-center gap-3 mb-3">
          <Image
            src="/avatars/makima.webp"
            alt="Makima"
            width={48}
            height={48}
            className="rounded-full object-cover ring-1 ring-red-500/30"
          />
          <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-base text-[#E5E5E5]">
            Makima &mdash; Final Assessment
          </h3>
        </div>

        {session.synthesis && (
          <p className="text-sm text-[rgba(255,255,255,0.7)] leading-relaxed mb-4">
            {session.synthesis}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Recommendation */}
          {session.recommendation && (
            <div className="rounded-sm border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <div className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider mb-1">
                Recommendation
              </div>
              <p className="text-xs text-[rgba(255,255,255,0.65)] leading-relaxed">
                {session.recommendation}
              </p>
            </div>
          )}

          {/* Strongest dissent */}
          {session.dissent && (
            <div className="rounded-sm border border-amber-500/20 bg-amber-500/[0.04] p-3">
              <div className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-1">
                Strongest Dissent
              </div>
              <p className="text-xs text-[rgba(255,255,255,0.65)] leading-relaxed">
                {session.dissent}
              </p>
            </div>
          )}
        </div>

        {/* Action buttons — only when callbacks provided */}
        {(onAccept || onReject || onIterate) && (
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/[0.06]">
            {onAccept && (
              <button
                onClick={onAccept}
                className="px-3 py-1.5 rounded-sm text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
              >
                Accept
              </button>
            )}
            {onReject && (
              <button
                onClick={onReject}
                className="px-3 py-1.5 rounded-sm text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
              >
                Reject
              </button>
            )}
            {onIterate && (
              <button
                onClick={onIterate}
                className="px-3 py-1.5 rounded-sm text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
              >
                Iterate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
