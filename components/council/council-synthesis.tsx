import type { CouncilSession } from "@/lib/types";

interface CouncilSynthesisProps {
  session: Pick<CouncilSession, "synthesis" | "recommendation" | "dissent">;
}

export function CouncilSynthesis({ session }: CouncilSynthesisProps) {
  if (!session.synthesis && !session.recommendation) return null;

  return (
    <div className="rounded-sm border border-red-500/20 bg-[rgba(239,68,68,0.04)] backdrop-blur-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-sm">
          🔗
        </div>
        <div>
          <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-[#E5E5E5]">
            Makima
          </h3>
          <p className="text-[11px] text-[rgba(255,255,255,0.35)]">The Controller — Synthesis</p>
        </div>
      </div>

      {/* Synthesis */}
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
    </div>
  );
}
