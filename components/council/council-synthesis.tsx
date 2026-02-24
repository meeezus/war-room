import Image from "next/image";
import type { CouncilSession } from "@/lib/types";

interface CouncilSynthesisProps {
  session: Pick<CouncilSession, "synthesis" | "recommendation" | "dissent">;
}

export function CouncilSynthesis({ session }: CouncilSynthesisProps) {
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
          <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-base text-foreground">
            Makima &mdash; Final Assessment
          </h3>
        </div>

        {session.synthesis && (
          <p className="text-sm text-foreground/70 leading-relaxed mb-4">
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
              <p className="text-xs text-foreground/60 leading-relaxed">
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
              <p className="text-xs text-foreground/60 leading-relaxed">
                {session.dissent}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
