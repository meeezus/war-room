"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { StealthCard } from "./stealth-card";
import type { MissionWithSteps } from "./mission-kanban-card";

const STATUS_COLORS: Record<string, string> = {
  queued: "#6b7280",
  running: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444",
  stale: "#eab308",
};

type SortKey = "status" | "title" | "assigned_to" | "progress" | "created_at" | "duration";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = {
  running: 0,
  queued: 1,
  failed: 2,
  stale: 3,
  completed: 4,
};

function getDurationMs(mission: MissionWithSteps): number {
  if (!mission.started_at) return 0;
  const start = new Date(mission.started_at).getTime();
  const end = mission.completed_at
    ? new Date(mission.completed_at).getTime()
    : Date.now();
  return end - start;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

function getProgress(mission: MissionWithSteps): number {
  const { total, completed } = mission.stepCounts;
  return total > 0 ? completed / total : 0;
}

interface MissionTableViewProps {
  missions: MissionWithSteps[];
}

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "status", label: "Status", className: "w-[72px]" },
  { key: "title", label: "Title" },
  { key: "assigned_to", label: "Agent", className: "w-[120px]" },
  { key: "progress", label: "Progress", className: "w-[140px]" },
  { key: "created_at", label: "Created", className: "w-[100px]" },
  { key: "duration", label: "Duration", className: "w-[90px]" },
];

export function MissionTableView({ missions }: MissionTableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...missions];
    const dir = sortDir === "asc" ? 1 : -1;

    copy.sort((a, b) => {
      switch (sortKey) {
        case "status":
          return dir * ((STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
        case "title":
          return dir * a.title.localeCompare(b.title);
        case "assigned_to":
          return dir * a.assigned_to.localeCompare(b.assigned_to);
        case "progress":
          return dir * (getProgress(a) - getProgress(b));
        case "created_at":
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case "duration":
          return dir * (getDurationMs(a) - getDurationMs(b));
        default:
          return 0;
      }
    });

    return copy;
  }, [missions, sortKey, sortDir]);

  return (
    <StealthCard hover={false} className="overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`cursor-pointer select-none px-3 py-2.5 text-left font-[family-name:var(--font-space-grotesk)] text-[11px] font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)] transition-colors hover:text-[rgba(255,255,255,0.6)] ${col.className ?? ""}`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (
                    <span className="text-[10px] text-[rgba(255,255,255,0.3)]">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((mission) => {
            const accent = STATUS_COLORS[mission.status] ?? "#6b7280";
            const { total, completed } = mission.stepCounts;
            const progressPct = total > 0 ? (completed / total) * 100 : 0;
            const durationMs = getDurationMs(mission);

            return (
              <tr
                key={mission.id}
                className="border-b border-white/[0.06] last:border-b-0 transition-colors hover:bg-white/[0.03]"
              >
                {/* Status */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] capitalize text-[rgba(255,255,255,0.5)]">
                      {mission.status}
                    </span>
                  </div>
                </td>

                {/* Title */}
                <td className="px-3 py-2.5">
                  <Link
                    href={`/missions/${mission.id}`}
                    className="font-[family-name:var(--font-space-grotesk)] text-sm text-[#E5E5E5] transition-colors hover:text-white"
                  >
                    {mission.title}
                  </Link>
                </td>

                {/* Agent */}
                <td className="px-3 py-2.5">
                  <Link
                    href={`/agents/${mission.assigned_to}`}
                    className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[rgba(255,255,255,0.5)] transition-colors hover:text-[rgba(255,255,255,0.7)]"
                  >
                    {mission.assigned_to}
                  </Link>
                </td>

                {/* Progress */}
                <td className="px-3 py-2.5">
                  {total > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progressPct}%`,
                            backgroundColor: accent,
                          }}
                        />
                      </div>
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tabular-nums text-[rgba(255,255,255,0.4)]">
                        {completed}/{total}
                      </span>
                    </div>
                  ) : (
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.25)]">
                      —
                    </span>
                  )}
                </td>

                {/* Created */}
                <td className="px-3 py-2.5">
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tabular-nums text-[rgba(255,255,255,0.5)]">
                    {new Date(mission.created_at).toLocaleDateString()}
                  </span>
                </td>

                {/* Duration */}
                <td className="px-3 py-2.5">
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tabular-nums text-[rgba(255,255,255,0.5)]">
                    {formatDuration(durationMs)}
                  </span>
                </td>
              </tr>
            );
          })}

          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="px-3 py-8 text-center font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.25)]"
              >
                No missions
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </StealthCard>
  );
}
