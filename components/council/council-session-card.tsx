"use client";

import Link from "next/link";
import type { CouncilSession } from "@/lib/types";

interface CouncilSessionCardProps {
  session: CouncilSession;
}

const COUNCIL_TYPE_LABELS: Record<string, string> = {
  full: "Full Council",
  technical: "Technical",
  business: "Business",
  security: "Security",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CouncilSessionCard({ session }: CouncilSessionCardProps) {
  const typeLabel = COUNCIL_TYPE_LABELS[session.council_type] ?? session.council_type;
  const approvals = session.reviews.filter((r) => r.verdict === "approve").length;
  const concerns = session.reviews.filter((r) => r.verdict === "concern").length;
  const rejections = session.reviews.filter((r) => r.verdict === "reject").length;

  return (
    <Link href={`/council/${session.id}`}>
      <div className="relative rounded-sm border border-border bg-card backdrop-blur-xl p-4 transition-all duration-300 hover:-translate-y-px hover:border-border hover:bg-card cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-foreground line-clamp-2 mb-1">
              {session.topic}
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/75">
              <span>{formatDate(session.created_at)}</span>
              <span>·</span>
              <span>{session.reviews.length} voices</span>
              {session.source && session.source !== "claude_code" && (
                <>
                  <span>·</span>
                  <span>{session.source}</span>
                </>
              )}
            </div>
          </div>

          <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-border text-muted-foreground flex-shrink-0">
            {typeLabel}
          </span>
        </div>

        {/* Verdict summary */}
        {session.reviews.length > 0 && (
          <div className="flex items-center gap-3 mt-3">
            {approvals > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {approvals} approve
              </span>
            )}
            {concerns > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                {concerns} concern
              </span>
            )}
            {rejections > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                {rejections} reject
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
