"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ObjectiveWithMetrics } from "@/lib/types";
import { hoverLift, tapScale, SPRING_CONFIG } from "@/lib/motion";
import { StealthCard } from "./stealth-card";

const OBJECTIVE_STATUS_COLORS: Record<string, string> = {
  active: "#10b981",   // emerald
  paused: "#f59e0b",   // amber
  completed: "#10b981", // emerald
  failed: "#ef4444",   // red
  capped: "#f59e0b",   // amber
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface ObjectiveCardProps {
  objective: ObjectiveWithMetrics;
}

export function ObjectiveCard({ objective }: ObjectiveCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const accent = OBJECTIVE_STATUS_COLORS[objective.status] ?? "#6b7280";
  const progressPct = objective.totalMissions > 0
    ? (objective.completedMissions / objective.totalMissions) * 100
    : 0;

  const cardContent = (
    <StealthCard className="p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-foreground">
          {objective.title}
        </h3>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium"
          style={{ backgroundColor: `${accent}20`, color: accent }}
        >
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
          {objective.status}
        </span>
      </div>

      {objective.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {objective.description}
        </p>
      )}

      {/* Mission progress bar */}
      <div className="mt-2">
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/75">
          {objective.completedMissions}/{objective.totalMissions} missions
        </div>
      </div>

      {/* Metrics row */}
      <div className="mt-2 flex items-center gap-2">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/75">
          {objective.activeMissions} active
        </span>
        {objective.pendingProposals > 0 && (
          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium text-amber-400">
            {objective.pendingProposals} pending
          </span>
        )}
      </div>

      {/* Footer: created_by + relative time */}
      <div className="mt-3 flex items-center gap-1.5">
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {objective.created_by}
        </span>
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/60">
          {relativeTime(objective.created_at)}
        </span>
      </div>
    </StealthCard>
  );

  return (
    <Link href={`/objectives/${objective.id}`}>
      <motion.div
        whileTap={prefersReducedMotion ? undefined : tapScale}
        whileHover={prefersReducedMotion ? undefined : hoverLift}
        transition={SPRING_CONFIG}
      >
        {cardContent}
      </motion.div>
    </Link>
  );
}
