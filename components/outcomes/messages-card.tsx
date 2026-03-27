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

export function MessagesCard({ data, unreadCount }: { data: OutcomeCard | null; unreadCount?: number }) {
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
      <div className="flex items-center gap-2 mb-2" title="Communications — morning briefs, notifications, unread messages">
        <span className="text-cyan-500 text-sm">&#9671;</span>
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-[family-name:var(--font-space-grotesk)]">
          Messages
        </span>
        {unreadCount != null && unreadCount > 0 && (
          <span className="ml-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-500">
            {unreadCount} unread
          </span>
        )}
      </div>

      <p className="text-xl font-semibold text-cyan-500 font-[family-name:var(--font-jetbrains-mono)] mb-2">
        {data.headline}
      </p>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground font-[family-name:var(--font-space-grotesk)]">
          Morning briefs and notification history will appear here
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
          className="inline-block text-xs text-cyan-500 hover:text-cyan-400 font-medium transition-colors"
        >
          {data.actionLabel}
        </Link>
      )}
    </StealthCard>
  );
}
