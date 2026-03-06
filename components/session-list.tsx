"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { StealthCard } from "@/components/stealth-card";
import type { Mission } from "@/lib/types";

type StatusFilter = "all" | "active" | "completed" | "failed";
type SortOrder = "newest" | "oldest";

const STATUS_DOT: Record<string, string> = {
  running: "bg-green-500",
  completed: "bg-blue-500",
  deployed: "bg-blue-500",
  failed: "bg-red-500",
  queued: "bg-zinc-500",
  review: "bg-amber-500",
  stale: "bg-yellow-500",
};

const STATUS_LABEL: Record<string, string> = {
  running: "running",
  completed: "done",
  deployed: "deployed",
  failed: "failed",
  queued: "queued",
  review: "review",
  stale: "stale",
};

function statusMatchesFilter(status: string, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return status === "running" || status === "queued" || status === "review";
  if (filter === "completed") return status === "completed" || status === "deployed";
  if (filter === "failed") return status === "failed" || status === "stale";
  return true;
}

function duration(started_at: string | null, completed_at: string | null): string {
  if (!started_at) return "—";
  const end = completed_at ? new Date(completed_at) : new Date();
  const start = new Date(started_at);
  const secs = Math.floor((end.getTime() - start.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

interface SessionCardProps {
  mission: Mission;
}

function SessionCard({ mission }: SessionCardProps) {
  const dotColor = STATUS_DOT[mission.status] ?? "bg-zinc-500";
  const label = STATUS_LABEL[mission.status] ?? mission.status;

  return (
    <Link href={`/missions/${mission.id}`}>
      <StealthCard className="cursor-pointer px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Status dot */}
          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dotColor)} />

          <div className="min-w-0 flex-1">
            {/* Title */}
            <p className="truncate font-[family-name:var(--font-space-grotesk)] text-[13px] font-medium leading-snug text-foreground">
              {mission.title}
            </p>

            {/* Meta row */}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/70">
                {mission.assigned_to}
              </span>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/50">
                {mission.started_at
                  ? formatDistanceToNowStrict(new Date(mission.started_at), { addSuffix: true })
                  : formatDistanceToNowStrict(new Date(mission.created_at), { addSuffix: true })}
              </span>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/50">
                {duration(mission.started_at, mission.completed_at)}
              </span>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={cn(
              "shrink-0 rounded-sm px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-wide",
              mission.status === "running" && "bg-green-500/10 text-green-400",
              (mission.status === "completed" || mission.status === "deployed") && "bg-blue-500/10 text-blue-400",
              mission.status === "failed" && "bg-red-500/10 text-red-400",
              mission.status === "queued" && "bg-zinc-500/10 text-zinc-400",
              mission.status === "review" && "bg-amber-500/10 text-amber-400",
              mission.status === "stale" && "bg-yellow-500/10 text-yellow-400",
            )}
          >
            {label}
          </span>
        </div>
      </StealthCard>
    </Link>
  );
}

interface SessionSummaryProps {
  missions: Mission[];
}

function SessionSummary({ missions }: SessionSummaryProps) {
  const total = missions.length;
  const active = missions.filter(
    (m) => m.status === "running" || m.status === "queued" || m.status === "review"
  ).length;

  // By-agent breakdown
  const byAgent: Record<string, number> = {};
  for (const m of missions) {
    byAgent[m.assigned_to] = (byAgent[m.assigned_to] ?? 0) + 1;
  }
  const agentEntries = Object.entries(byAgent).sort((a, b) => b[1] - a[1]);

  // By-status breakdown
  const byStatus: Record<string, number> = {};
  for (const m of missions) {
    byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
  }
  const statusEntries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <StealthCard hover={false} className="px-4 py-4">
      <p className="mb-3 font-[family-name:var(--font-space-grotesk)] text-[11px] font-semibold uppercase tracking-[1.2px] text-muted-foreground/60">
        Summary
      </p>

      {/* Totals */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[22px] font-bold tabular-nums text-foreground">
            {total}
          </p>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/60">
            total
          </p>
        </div>
        <div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[22px] font-bold tabular-nums text-green-400">
            {active}
          </p>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/60">
            active
          </p>
        </div>
      </div>

      {/* By agent */}
      {agentEntries.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 font-[family-name:var(--font-space-grotesk)] text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground/50">
            By Agent
          </p>
          <div className="space-y-1.5">
            {agentEntries.map(([agent, count]) => (
              <div key={agent} className="flex items-center justify-between">
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
                  {agent}
                </span>
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tabular-nums text-foreground">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By status */}
      {statusEntries.length > 0 && (
        <div>
          <p className="mb-2 font-[family-name:var(--font-space-grotesk)] text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground/50">
            By Status
          </p>
          <div className="space-y-1.5">
            {statusEntries.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status] ?? "bg-zinc-500")} />
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
                    {STATUS_LABEL[status] ?? status}
                  </span>
                </div>
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tabular-nums text-foreground">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </StealthCard>
  );
}

interface SessionListProps {
  missions: Mission[];
  filter: StatusFilter;
  sort: SortOrder;
}

export function SessionList({ missions, filter, sort }: SessionListProps) {
  const filtered = missions
    .filter((m) => statusMatchesFilter(m.status, filter))
    .sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sort === "newest" ? tb - ta : ta - tb;
    });

  return (
    <div className="flex gap-4">
      {/* Session list — 2/3 */}
      <div className="flex-[2] min-w-0">
        {filtered.length === 0 ? (
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] text-muted-foreground/50 py-8 text-center">
            No sessions
          </p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((m) => (
              <SessionCard key={m.id} mission={m} />
            ))}
          </div>
        )}
      </div>

      {/* Summary sidebar — 1/3 */}
      <div className="w-[220px] shrink-0">
        <SessionSummary missions={missions} />
      </div>
    </div>
  );
}
