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
  running: "bg-amber-500",
  reviewing: "bg-amber-500",
  approved: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
};

export function PlansCard({ data }: { data: OutcomeCard | null }) {
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

  const isEmpty = data.count === 0 && (!data.items || data.items.length === 0);

  return (
    <StealthCard className="p-4">
      <div className="flex items-center gap-2 mb-2" title="Plan execution pipeline — reviewing, approved, and running plans">
        <span className="text-violet-500 text-sm">&#9654;</span>
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-[family-name:var(--font-space-grotesk)]">
          Plans
        </span>
      </div>

      <p className="text-xl font-semibold text-violet-500 font-[family-name:var(--font-jetbrains-mono)] mb-2">
        {data.headline}
      </p>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground font-[family-name:var(--font-space-grotesk)]">
          Drop a markdown plan to start the execution pipeline
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

      <Link
        href="/plans"
        className="inline-block text-xs text-violet-500 hover:text-violet-400 font-medium transition-colors"
      >
        View Plans
      </Link>
    </StealthCard>
  );
}
