"use client";

import Link from "next/link";
import { StealthCard } from "@/components/stealth-card";
import type { OutcomeCard } from "@/lib/types";

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const statusColor: Record<string, string> = {
  done: "bg-green-500",
  active: "bg-green-500",
  pending: "bg-amber-500",
};

export function OpsecCard({ data }: { data: OutcomeCard | null }) {
  if (!data) {
    return (
      <StealthCard className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-6 w-32 rounded bg-muted" />
        </div>
      </StealthCard>
    );
  }

  const hasErrors = data.count > 0;
  const accentColor = hasErrors ? "text-red-500" : "text-amber-500";
  const isEmpty = data.count === 0 && (!data.items || data.items.length === 0);

  return (
    <StealthCard className="p-4">
      <div className="flex items-center gap-2 mb-2" title="Security &amp; system protection — Toji scans, patrol findings, error tracking">
        <span className={`${accentColor} text-sm`}>&#9651;</span>
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-[family-name:var(--font-space-grotesk)]">
          OPSEC
        </span>
      </div>

      <p className={`text-xl font-semibold ${accentColor} font-[family-name:var(--font-jetbrains-mono)] mb-2`}>
        {data.headline}
      </p>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground font-[family-name:var(--font-space-grotesk)]">
          All systems nominal — no errors in 24 hours
        </p>
      ) : (
        <ul className="space-y-1.5 mb-2">
          {data.items?.slice(0, 3).map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm font-[family-name:var(--font-space-grotesk)]">
              <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${statusColor[item.status ?? ""] ?? "bg-zinc-400"}`} />
              <span className="truncate text-foreground">{item.title}</span>
              <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                {relativeTime(item.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {data.actionLabel && data.actionHref && (
        <Link
          href={data.actionHref}
          className={`inline-block text-xs ${accentColor} hover:opacity-80 font-medium transition-colors`}
        >
          {data.actionLabel}
        </Link>
      )}
    </StealthCard>
  );
}
