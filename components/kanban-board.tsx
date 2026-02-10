"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { Mission } from "@/lib/types";
import { hoverLift, tapScale, SPRING_CONFIG } from "@/lib/motion";
import { StealthCard } from "./stealth-card";
import { useRealtimeMissions } from "@/lib/realtime";

const MISSION_COLUMNS: { id: Mission["status"]; label: string }[] = [
  { id: "queued", label: "Queued" },
  { id: "running", label: "Running" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

const STATUS_ACCENT: Record<string, string> = {
  queued: "#6b7280",
  running: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444",
  stale: "#eab308",
};

function MissionCard({ mission }: { mission: Mission }) {
  const prefersReducedMotion = useReducedMotion();
  const accent = STATUS_ACCENT[mission.status] ?? "#6b7280";

  return (
    <Link href={`/missions/${mission.id}`}>
      <motion.div
        whileTap={prefersReducedMotion ? undefined : tapScale}
        whileHover={prefersReducedMotion ? undefined : hoverLift}
        transition={SPRING_CONFIG}
        className="cursor-pointer rounded-sm border border-white/[0.06] bg-[#0F0F0F] p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-white/90">{mission.title}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium"
            style={{
              backgroundColor: `${accent}20`,
              color: accent,
            }}
          >
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ backgroundColor: accent }}
            />
            {mission.status}
          </span>
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40">
            {mission.assigned_to}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

export function KanbanBoard({ missions }: { missions: Mission[] }) {
  const liveMissions = useRealtimeMissions(missions);
  const columns = MISSION_COLUMNS.map((col) => ({
    ...col,
    missions: liveMissions.filter((m) => m.status === col.id),
  }));

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-4 gap-4">
        {columns.map((col) => (
          <StealthCard key={col.id} hover={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
              <h3 className="font-display text-xs font-semibold tracking-wide text-white/60 uppercase">
                {col.label}
              </h3>
              <span className="inline-flex size-5 items-center justify-center rounded bg-emerald-500/15 font-mono text-[10px] font-medium text-emerald-400">
                {col.missions.length}
              </span>
            </div>
            <div className="flex min-h-[120px] flex-col gap-2 p-2">
              {col.missions.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          </StealthCard>
        ))}
      </div>
    </div>
  );
}
