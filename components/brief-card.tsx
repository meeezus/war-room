"use client";

import { useState, useEffect } from "react";
import { StealthCard } from "./stealth-card";
import { getPendingDiscoveriesWithSeverity, getLastPatrolEvent } from "@/lib/queries";

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export function BriefCard() {
  const [severity, setSeverity] = useState({ total: 0, critical: 0, warning: 0, info: 0 });
  const [lastPatrol, setLastPatrol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [sev, patrol] = await Promise.all([
        getPendingDiscoveriesWithSeverity(),
        getLastPatrolEvent(),
      ]);
      setSeverity(sev);
      setLastPatrol(patrol?.created_at ?? null);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <StealthCard className="p-3">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.3)]">
          Loading brief...
        </p>
      </StealthCard>
    );
  }

  if (severity.total === 0) {
    return (
      <StealthCard className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium text-[rgba(255,255,255,0.6)]">
            Morning Brief
          </span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.3)]">
            {lastPatrol ? `Last patrol ${formatRelativeTime(lastPatrol)}` : "No patrol yet"}
          </span>
        </div>
        <p className="mt-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.3)]">
          No pending discoveries
        </p>
      </StealthCard>
    );
  }

  return (
    <StealthCard className="p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium text-[rgba(255,255,255,0.7)]">
          Morning Brief
        </span>
        <a
          href="/api/brief/latest"
          target="_blank"
          rel="noopener noreferrer"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.7)] transition-colors"
        >
          View Brief →
        </a>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {severity.critical > 0 && (
          <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium text-red-400">
            {severity.critical} critical
          </span>
        )}
        {severity.warning > 0 && (
          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium text-amber-400">
            {severity.warning} warning
          </span>
        )}
        {severity.info > 0 && (
          <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium text-blue-400">
            {severity.info} info
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.3)]">
          {severity.total} discover{severity.total === 1 ? "y" : "ies"} awaiting review
        </span>
        {lastPatrol && (
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.2)]">
            {formatRelativeTime(lastPatrol)}
          </span>
        )}
      </div>
    </StealthCard>
  );
}
