"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import { getMissions } from "@/lib/queries";
import type { Mission } from "@/lib/types";
import { StealthCard } from "@/components/stealth-card";
import { staggerContainer, staggerItem } from "@/lib/motion";

const STATUS_ACCENT: Record<string, string> = {
  queued: "#6b7280",
  running: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444",
  stale: "#eab308",
};

const FILTER_OPTIONS = ["all", "queued", "running", "completed", "failed", "stale"] as const;
type FilterStatus = (typeof FILTER_OPTIONS)[number];

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  if (!completedAt) return `${mins}m ${secs}s (running)`;
  if (mins < 1) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    async function fetchData() {
      const data = await getMissions();
      setMissions(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (!supabase) {
    return (
      <div className="flex h-screen flex-col bg-background p-4">
        <div className="flex h-full items-center justify-center">
          <StealthCard className="max-w-md p-8 text-center">
            <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-[#E5E5E5]">
              Connect Supabase to see live data
            </h2>
            <p className="mb-4 text-sm text-[rgba(255,255,255,0.5)]">
              Add these environment variables to your{" "}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs">
                .env.local
              </code>{" "}
              file:
            </p>
            <div className="rounded-sm bg-white/[0.04] p-4 text-left font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.5)]">
              <p>NEXT_PUBLIC_SUPABASE_URL=your-url</p>
              <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key</p>
            </div>
          </StealthCard>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-[rgba(255,255,255,0.4)]">
          Loading missions...
        </p>
      </div>
    );
  }

  const filtered = filter === "all" ? missions : missions.filter((m) => m.status === filter);

  const counts: Record<FilterStatus, number> = {
    all: missions.length,
    queued: missions.filter((m) => m.status === "queued").length,
    running: missions.filter((m) => m.status === "running").length,
    completed: missions.filter((m) => m.status === "completed").length,
    failed: missions.filter((m) => m.status === "failed").length,
    stale: missions.filter((m) => m.status === "stale").length,
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-[rgba(255,255,255,0.4)]">
          <Link href="/dashboard" className="transition-colors hover:text-[#E5E5E5]">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-[rgba(255,255,255,0.6)]">Missions</span>
        </nav>

        {/* Header */}
        <div className="flex items-baseline justify-between">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-[#E5E5E5]">
            Missions
          </h1>
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[rgba(255,255,255,0.3)]">
            {filtered.length} mission{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => {
            const isActive = filter === option;
            const accent = option === "all" ? "#E5E5E5" : STATUS_ACCENT[option];
            const count = counts[option];

            // Hide filters with 0 count (except "all" and active filter)
            if (count === 0 && option !== "all" && !isActive) return null;

            return (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs transition-all"
                style={{
                  backgroundColor: isActive ? `${accent}20` : "rgba(255,255,255,0.04)",
                  color: isActive ? accent : "rgba(255,255,255,0.4)",
                  borderWidth: 1,
                  borderColor: isActive ? `${accent}30` : "rgba(255,255,255,0.08)",
                }}
              >
                {option !== "all" && (
                  <span
                    className="inline-block size-1.5 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                )}
                {option}
                <span
                  className="ml-0.5 tabular-nums"
                  style={{ opacity: 0.6 }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mission list */}
        {filtered.length === 0 ? (
          <StealthCard className="p-8 text-center">
            <p className="text-sm text-[rgba(255,255,255,0.4)]">
              No {filter === "all" ? "" : filter + " "}missions found.
            </p>
          </StealthCard>
        ) : (
          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            key={filter} // re-animate on filter change
          >
            {filtered.map((mission) => {
              const accent = STATUS_ACCENT[mission.status] ?? "#6b7280";
              const duration = formatDuration(mission.started_at, mission.completed_at);

              return (
                <motion.div key={mission.id} variants={staggerItem}>
                  <Link href={`/missions/${mission.id}`}>
                    <StealthCard className="flex items-center gap-4 px-4 py-3">
                      {/* Status dot */}
                      <span
                        className="size-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: accent }}
                      />

                      {/* Title + agent */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-[#E5E5E5]">
                          {mission.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.4)]">
                          Agent:{" "}
                          <Link
                            href={`/agents/${mission.assigned_to}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-emerald-400/80 transition-colors hover:text-emerald-400"
                          >
                            {mission.assigned_to}
                          </Link>
                        </p>
                      </div>

                      {/* Meta: duration + date */}
                      <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                        {duration && (
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[rgba(255,255,255,0.35)]">
                            {duration}
                          </span>
                        )}
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[rgba(255,255,255,0.25)]">
                          {formatTimestamp(mission.created_at)}
                        </span>
                      </div>

                      {/* Status badge */}
                      <span
                        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] font-medium"
                        style={{
                          backgroundColor: `${accent}15`,
                          color: accent,
                        }}
                      >
                        {mission.status}
                      </span>
                    </StealthCard>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
