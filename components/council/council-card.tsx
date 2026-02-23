"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { getRoleCard } from "@/lib/role-cards";
import type { CouncilReview } from "@/lib/types";

interface CouncilCardProps {
  review: CouncilReview;
}

const VERDICT_STYLES: Record<string, { label: string; className: string }> = {
  approve: { label: "Approve", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  concern: { label: "Concern", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  reject: { label: "Reject", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  abstain: { label: "Abstain", className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

export function CouncilCard({ review }: CouncilCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (el) {
      // Check if text overflows 3 lines (line-clamp-3)
      setClamped(el.scrollHeight > el.clientHeight);
    }
  }, [review.voice_text]);

  const roleCard = getRoleCard(review.name.toLowerCase());
  const verdict = VERDICT_STYLES[review.verdict] ?? VERDICT_STYLES.abstain;
  const color = roleCard.color ?? "#6b7280";

  return (
    <div
      className="relative rounded-sm border border-white/[0.08] bg-[rgba(10,10,10,0.8)] backdrop-blur-xl p-4 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-px hover:border-white/[0.15]"
      style={{ boxShadow: `0 0 0 1px ${color}10, inset 0 1px 0 rgba(255,255,255,0.04)` }}
    >
      {/* Glow ring using daimyo color */}
      <div
        className="absolute inset-0 rounded-sm opacity-20 pointer-events-none"
        style={{ boxShadow: `inset 0 0 20px ${color}15` }}
      />

      {/* Header: avatar + name + verdict */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          {roleCard.avatarPath ? (
            <Image
              src={roleCard.avatarPath}
              alt={roleCard.name}
              width={48}
              height={48}
              className="rounded-full object-cover ring-1"
              style={{ ringColor: color } as React.CSSProperties}
              onError={(e) => {
                // Fallback to emoji on image error
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `<div class="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold" style="background: ${color}22; color: ${color}; border: 1px solid ${color}44">${roleCard.emoji}</div>`;
                }
              }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg"
              style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
            >
              {roleCard.emoji}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-[#E5E5E5]">
              {roleCard.name}
            </span>
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${verdict.className}`}
            >
              {verdict.label}
            </span>
          </div>
          <div className="text-[11px] text-[rgba(255,255,255,0.35)] mt-0.5">
            {roleCard.title}
          </div>
        </div>
      </div>

      {/* Voice text */}
      <p
        ref={textRef}
        className={`text-xs text-[rgba(255,255,255,0.6)] leading-relaxed ${expanded ? "" : "line-clamp-3"}`}
      >
        {review.voice_text}
      </p>

      {/* Show more / Show less */}
      {(clamped || expanded) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.7)] transition-colors self-start -mt-1"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
