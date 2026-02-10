"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { Mission, Step } from "@/lib/types";
import { startMission } from "@/lib/queries";
import { StealthCard } from "./stealth-card";
import { StepCard } from "./step-card";
import { staggerContainer } from "@/lib/motion";
import { useRealtimeSteps } from "@/lib/realtime";

const STATUS_ACCENT: Record<string, string> = {
  queued: "#6b7280",
  running: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444",
  stale: "#eab308",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "Not started";
  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  if (!completedAt) return `Running for ${mins}m ${secs}s`;
  if (mins < 1) return `Completed in ${secs}s`;
  return `Completed in ${mins}m ${secs}s`;
}

export function MissionDetail({
  mission,
  steps,
}: {
  mission: Mission;
  steps: Step[];
}) {
  const [missionStatus, setMissionStatus] = useState(mission.status);
  const [starting, setStarting] = useState(false);
  const liveSteps = useRealtimeSteps(mission.id, steps);
  const accent = STATUS_ACCENT[missionStatus] ?? "#6b7280";

  async function handleStart() {
    setStarting(true);
    const ok = await startMission(mission.id);
    if (ok) setMissionStatus("running");
    setStarting(false);
  }
  const completedSteps = liveSteps.filter((s) => s.status === "completed").length;
  const totalSteps = liveSteps.length;
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[rgba(255,255,255,0.4)]">
        <Link
          href="/dashboard"
          className="hover:text-[#E5E5E5] transition-colors"
        >
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-[rgba(255,255,255,0.6)]">
          Mission: {mission.title}
        </span>
      </nav>

      {/* Mission header card */}
      <StealthCard className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-[#E5E5E5]">
            {mission.title}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {missionStatus === "queued" && (
              <button
                onClick={handleStart}
                disabled={starting}
                className="rounded bg-blue-500/15 px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/25 disabled:opacity-50"
              >
                {starting ? "Starting..." : "Execute"}
              </button>
            )}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs font-medium"
              style={{
                backgroundColor: `${accent}20`,
                color: accent,
              }}
            >
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: accent }}
              />
              {missionStatus}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[rgba(255,255,255,0.4)]">
          {/* Agent */}
          <span>
            Agent:{" "}
            <Link
              href={`/agents/${mission.assigned_to}`}
              className="text-emerald-400/80 hover:text-emerald-400 transition-colors"
            >
              {mission.assigned_to}
            </Link>
          </span>

          {/* Duration */}
          <span className="font-[family-name:var(--font-jetbrains-mono)]">
            {formatDuration(mission.started_at, mission.completed_at)}
          </span>

          {/* Created */}
          <span className="font-[family-name:var(--font-jetbrains-mono)]">
            Created {formatTimestamp(mission.created_at)}
          </span>
        </div>
      </StealthCard>

      {/* Progress bar */}
      {totalSteps > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[rgba(255,255,255,0.4)]">
            <span className="font-[family-name:var(--font-space-grotesk)] font-medium">
              Steps
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)]">
              {completedSteps} / {totalSteps}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Step list */}
      {totalSteps > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {liveSteps.map((step) => (
            <StepCard key={step.id} step={step} />
          ))}
        </motion.div>
      ) : (
        <StealthCard className="p-6 text-center">
          <p className="text-sm text-[rgba(255,255,255,0.4)]">
            No steps found for this mission.
          </p>
        </StealthCard>
      )}
    </div>
  );
}
