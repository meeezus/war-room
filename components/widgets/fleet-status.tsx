"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface FleetStatusProps {
  agentsOnline: number;
  tasksRunning: number;
  errors24h: number;
  activeSessions: number;
}

export function FleetStatus({
  agentsOnline,
  tasksRunning,
  errors24h,
  activeSessions,
}: FleetStatusProps) {
  const allIdle =
    agentsOnline === 0 && tasksRunning === 0 && errors24h === 0 && activeSessions === 0;

  if (allIdle) {
    return (
      <div className="flex h-8 items-center px-3 font-[family-name:var(--font-space-grotesk)] text-sm text-[var(--foreground)]/40">
        Fleet idle
      </div>
    );
  }

  return (
    <div className="flex h-8 items-center gap-3 px-3 font-[family-name:var(--font-space-grotesk)] text-sm text-[var(--foreground)]/60">
      <Link href="/agents">
        <span className={cn(agentsOnline > 0 ? "text-green-400" : "text-gray-500")}>
          {agentsOnline} agents active
        </span>
      </Link>

      <span className="text-[var(--foreground)]/20">&middot;</span>

      <Link href="/tasks">
        <span className={cn(tasksRunning > 0 ? "text-blue-400" : "text-gray-500")}>
          {tasksRunning} tasks running
        </span>
      </Link>

      {errors24h > 0 && (
        <>
          <span className="text-[var(--foreground)]/20">&middot;</span>
          <span className="text-red-400">
            {errors24h} error{errors24h !== 1 ? "s" : ""} (24h)
          </span>
        </>
      )}
    </div>
  );
}
