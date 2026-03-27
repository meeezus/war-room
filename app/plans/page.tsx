"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SidebarNav } from "@/components/sidebar-nav";
import { StealthCard } from "@/components/stealth-card";
import type { Plan } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type PlanStatus = Plan["status"] | "all";

const FILTER_TABS: { key: PlanStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "reviewing", label: "Reviewing" },
  { key: "completed", label: "Completed" },
  { key: "draft", label: "Draft" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  brainstorming: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  analyzing: "bg-purple-500/15 text-purple-400 border-purple-500/30 animate-pulse",
  reviewing: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  approved: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  running: "bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const SCORE_COLORS: Record<string, string> = {
  low: "text-green-400",     // 3-4
  standard: "text-blue-400", // 5-6
  high: "text-amber-400",    // 7-8
  critical: "text-red-400",  // 9
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground/40";
  if (score <= 4) return SCORE_COLORS.low;
  if (score <= 6) return SCORE_COLORS.standard;
  if (score <= 8) return SCORE_COLORS.high;
  return SCORE_COLORS.critical;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PlanStatus>("all");

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(Array.isArray(data) ? data : (data.plans ?? []));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const filtered =
    filter === "all" ? plans : plans.filter((p) => p.status === filter);

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex h-10 flex-shrink-0 items-center gap-4 border-b border-border/50 px-5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
          <span>Tenshu</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground/60">Plans</span>
          <span className="flex-1" />
          <span className="tabular-nums">{plans.length} total</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-5xl space-y-4">
            {/* Header */}
            <div className="flex items-baseline gap-3">
              <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-foreground">
                Plans
              </h1>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`rounded-sm px-3 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs transition-colors ${
                    filter === tab.key
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Loading */}
            {loading && (
              <div className="py-12 text-center">
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground">
                  Loading plans...
                </p>
              </div>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
              <div className="py-12 text-center">
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground/50">
                  {plans.length === 0
                    ? "No plans yet \u2014 drop a markdown plan to get started"
                    : "No plans match this filter"}
                </p>
              </div>
            )}

            {/* Plan rows */}
            {!loading &&
              filtered.map((plan) => {
                const beadCount = plan.parsed_beads?.length ?? 0;
                const statusClass =
                  STATUS_COLORS[plan.status] ?? STATUS_COLORS.draft;

                return (
                  <Link key={plan.id} href={`/plans/${plan.id}`}>
                    <StealthCard className="flex cursor-pointer items-center gap-4 p-4">
                      {/* Status badge */}
                      <span
                        className={`shrink-0 rounded border px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}
                      >
                        {plan.status}
                      </span>

                      {/* Title + meta */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-foreground">
                          {plan.title}
                        </p>
                        <p className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/60">
                          {beadCount} {beadCount === 1 ? "bead" : "beads"}{" "}
                          &middot; {plan.wave_count}{" "}
                          {plan.wave_count === 1 ? "wave" : "waves"} &middot;{" "}
                          {relativeTime(plan.created_at)}
                        </p>
                      </div>

                      {/* Flywheel score */}
                      {plan.flywheel_score !== null && (
                        <span
                          className={`shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tabular-nums ${scoreColor(plan.flywheel_score)}`}
                        >
                          {plan.flywheel_score}
                        </span>
                      )}
                    </StealthCard>
                  </Link>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
