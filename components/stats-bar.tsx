"use client";

import type { DashboardStats } from "@/lib/types";
import { StealthCard } from "./stealth-card";

function StatCell({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <StealthCard hover={false} className="flex items-center gap-3 px-4 py-3">
      {color && (
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
      )}
      <div>
        <p className="font-[family-name:var(--font-space-grotesk)] text-xs uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
          {label}
        </p>
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-lg font-medium text-[#E5E5E5]">
          {value}
        </p>
      </div>
    </StealthCard>
  );
}

export function StatsBar({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCell label="Active Agents" value={stats.activeAgents} color="#10b981" />
      <StatCell label="In Progress" value={stats.inProgressTasks} color="#3b82f6" />
      <StatCell label="Pending Reviews" value={stats.pendingReviews} color="#8b5cf6" />
      <StatCell label="Pending Proposals" value={stats.pendingProposals} color="#eab308" />
    </div>
  );
}
