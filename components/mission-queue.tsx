"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { StealthCard } from "@/components/stealth-card";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { Mission } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  queued: "#6b7280",
  running: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444",
};

interface MissionQueueProps {
  missions: Mission[];
}

export function MissionQueue({ missions }: MissionQueueProps) {
  const [executing, setExecuting] = useState<string | null>(null);

  if (missions.length === 0) return null;

  async function handleExecute(e: React.MouseEvent, missionId: string) {
    e.preventDefault();
    e.stopPropagation();
    setExecuting(missionId);
    try {
      await fetch(`/api/missions/${missionId}/execute`, { method: "POST" });
    } catch (err) {
      console.error("Execute failed:", err);
    } finally {
      setExecuting(null);
    }
  }

  return (
    <motion.div
      className="flex gap-3 overflow-x-auto pb-1"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {missions.map((mission) => (
        <motion.div key={mission.id} variants={staggerItem}>
          <Link href={`/missions/${mission.id}`}>
            <StealthCard className="flex w-56 flex-shrink-0 items-center gap-3 px-3 py-2.5">
              {/* Status dot */}
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[mission.status] ?? "#6b7280" }}
              />

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-[family-name:var(--font-space-grotesk)] text-xs font-medium text-[#E5E5E5]">
                  {mission.title}
                </p>
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.4)]">
                  {mission.assigned_to}
                </p>
              </div>

              {/* Status badge / Execute button */}
              {mission.status === "queued" ? (
                <button
                  onClick={(e) => handleExecute(e, mission.id)}
                  disabled={executing === mission.id}
                  className="flex-shrink-0 rounded border border-white/[0.12] px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.5)] transition-colors hover:border-white/[0.25] hover:text-[#E5E5E5] disabled:opacity-40"
                >
                  {executing === mission.id ? "..." : "Exec"}
                </button>
              ) : (
                <span
                  className="flex-shrink-0 rounded px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px]"
                  style={{
                    color: STATUS_COLORS[mission.status],
                    backgroundColor: `${STATUS_COLORS[mission.status]}15`,
                  }}
                >
                  {mission.status}
                </span>
              )}
            </StealthCard>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
