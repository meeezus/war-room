"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import type { Mission } from "@/lib/types";
import { hoverLift, tapScale, SPRING_CONFIG } from "@/lib/motion";
import { StealthCard } from "./stealth-card";

const STATUS_COLORS: Record<string, string> = {
  queued: "#6b7280",
  running: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444",
  stale: "#eab308",
};

export interface MissionWithSteps extends Mission {
  stepCounts: { total: number; completed: number };
  description: string | null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-white/25">
        {label}
      </span>
      <span className="text-xs text-[rgba(255,255,255,0.5)]">{value}</span>
    </div>
  );
}

function formatDuration(start: string, end?: string | null): string {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diffMs = endDate.getTime() - startDate.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

export function MissionKanbanCard({ mission }: { mission: MissionWithSteps }) {
  const [expanded, setExpanded] = useState(false);
  const [executing, setExecuting] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const accent = STATUS_COLORS[mission.status] ?? "#6b7280";
  const { total, completed } = mission.stepCounts;
  const progressPct = total > 0 ? (completed / total) * 100 : 0;

  async function handleExecute(e: React.MouseEvent) {
    e.stopPropagation();
    setExecuting(true);
    try {
      await fetch(`/api/missions/${mission.id}/execute`, { method: "POST" });
    } catch (err) {
      console.error("Execute failed:", err);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <motion.div
      className="cursor-pointer"
      onClick={() => setExpanded((prev) => !prev)}
      whileTap={prefersReducedMotion ? undefined : tapScale}
      whileHover={prefersReducedMotion ? undefined : hoverLift}
      transition={SPRING_CONFIG}
    >
      <StealthCard className="p-3">
        {/* Title */}
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/missions/${mission.id}`}
            onClick={(e) => e.stopPropagation()}
            className="line-clamp-2 font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-[#E5E5E5] transition-colors hover:text-white"
          >
            {mission.title}
          </Link>
          {mission.status === "queued" && (
            <button
              onClick={handleExecute}
              disabled={executing}
              className="flex-shrink-0 rounded border border-white/[0.12] px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.5)] transition-colors hover:border-emerald-500/50 hover:text-emerald-400 disabled:opacity-40"
            >
              {executing ? "..." : "Execute"}
            </button>
          )}
        </div>

        {/* Agent + step progress */}
        <div className="mt-2 flex items-center gap-2">
          <Link
            href={`/agents/${mission.assigned_to}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40 transition-colors hover:text-white/60"
          >
            {mission.assigned_to}
          </Link>
          {total > 0 && (
            <div className="flex flex-1 items-center gap-1.5">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: accent,
                  }}
                />
              </div>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tabular-nums text-white/30">
                {completed}/{total}
              </span>
            </div>
          )}
        </div>

        {/* Duration for running/completed */}
        {mission.started_at && (
          <p className="mt-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-white/25">
            {mission.status === "running" ? "Running " : ""}
            {formatDuration(mission.started_at, mission.completed_at)}
          </p>
        )}

        {/* Expandable details */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-2 border-t border-white/[0.06] pt-2 space-y-2">
                {/* Description */}
                {mission.description && (
                  <p className="line-clamp-3 text-xs text-[rgba(255,255,255,0.5)]">
                    {mission.description}
                  </p>
                )}

                {/* Step summary */}
                {total > 0 && (
                  <DetailRow
                    label="Steps"
                    value={`${completed}/${total} completed`}
                  />
                )}

                {/* Result summary */}
                {mission.result && Object.keys(mission.result).length > 0 && (
                  <div className="flex gap-2">
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-white/25">
                      Result
                    </span>
                    {typeof mission.result.summary === "string" ? (
                      <span className="line-clamp-2 text-xs text-[rgba(255,255,255,0.5)]">
                        {mission.result.summary}
                      </span>
                    ) : (
                      <Link
                        href={`/missions/${mission.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-400/70 transition-colors hover:text-blue-300"
                      >
                        Result available
                      </Link>
                    )}
                  </div>
                )}

                {/* Dates — compact single line */}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  <DetailRow
                    label="Created"
                    value={new Date(mission.created_at).toLocaleDateString()}
                  />
                  {mission.started_at && (
                    <DetailRow
                      label="Started"
                      value={new Date(mission.started_at).toLocaleDateString()}
                    />
                  )}
                  {mission.completed_at && (
                    <DetailRow
                      label="Done"
                      value={new Date(mission.completed_at).toLocaleDateString()}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </StealthCard>
    </motion.div>
  );
}
