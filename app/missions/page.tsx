"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import { getMissions } from "@/lib/queries";
import type { Mission } from "@/lib/types";
import { StealthCard } from "@/components/stealth-card";
import { staggerContainer, staggerItem } from "@/lib/motion";

// ─── Constants ────────────────────────────────────────────────────────────────

const KANBAN_COLUMNS = [
  { key: "queued",    label: "Queued",    colorClass: "text-blue-500",   bgClass: "bg-blue-500/10",   borderClass: "border-blue-500/20" },
  { key: "running",   label: "Running",   colorClass: "text-amber-500",  bgClass: "bg-amber-500/10",  borderClass: "border-amber-500/20" },
  { key: "completed", label: "Completed", colorClass: "text-green-500",  bgClass: "bg-green-500/10",  borderClass: "border-green-500/20" },
  { key: "failed",    label: "Failed",    colorClass: "text-red-500",    bgClass: "bg-red-500/10",    borderClass: "border-red-500/20" },
] as const;

type KanbanStatus = (typeof KANBAN_COLUMNS)[number]["key"];

const STATUS_DOT: Record<string, string> = {
  queued:    "bg-blue-500",
  running:   "bg-amber-500",
  completed: "bg-green-500",
  deployed:  "bg-emerald-500",
  failed:    "bg-red-500",
  stale:     "bg-yellow-500",
};

const FILTER_OPTIONS = ["all", "queued", "running", "completed", "failed", "stale"] as const;
type FilterStatus = (typeof FILTER_OPTIONS)[number];

type SortKey = "newest" | "oldest" | "longest";
type ViewMode = "kanban" | "table";

const VIEW_STORAGE_KEY = "missions-view-mode";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (!completedAt) return `${mins}m ${secs}s`;
  if (mins < 1) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function elapsedMs(startedAt: string | null): number {
  if (!startedAt) return 0;
  return Date.now() - new Date(startedAt).getTime();
}

function sortMissions(missions: Mission[], sort: SortKey): Mission[] {
  return [...missions].sort((a, b) => {
    if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sort === "longest") return elapsedMs(b.started_at) - elapsedMs(a.started_at);
    return 0;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KanbanCard({ mission }: { mission: Mission }) {
  const duration = formatDuration(mission.started_at, mission.completed_at);
  const dotClass = STATUS_DOT[mission.status] ?? "bg-muted-foreground";

  return (
    <Link href={`/missions/${mission.id}`}>
      <StealthCard className="p-3 cursor-pointer">
        <div className="flex items-start gap-2">
          <span className={`mt-1 size-1.5 flex-shrink-0 rounded-full ${dotClass}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-foreground leading-snug">
              {mission.title}
            </p>
            <p className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
              {mission.assigned_to}
            </p>
            {duration && (
              <p className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/60 tabular-nums">
                {duration}
              </p>
            )}
          </div>
        </div>
      </StealthCard>
    </Link>
  );
}

function KanbanColumn({
  column,
  missions,
}: {
  column: (typeof KANBAN_COLUMNS)[number];
  missions: Mission[];
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {/* Column header */}
      <div className={`flex items-center justify-between rounded-sm px-3 py-1.5 ${column.bgClass} border ${column.borderClass}`}>
        <span className={`font-[family-name:var(--font-space-grotesk)] text-xs font-semibold uppercase tracking-wider ${column.colorClass}`}>
          {column.label}
        </span>
        <span className={`font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums ${column.colorClass} opacity-70`}>
          {missions.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {missions.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border px-3 py-4 text-center">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/40">
              empty
            </p>
          </div>
        ) : (
          missions.map((m) => <KanbanCard key={m.id} mission={m} />)
        )}
      </div>
    </div>
  );
}

type TableSortCol = "status" | "created_at" | "assigned_to" | "started_at";
type TableSortDir = "asc" | "desc";

function TableView({ missions }: { missions: Mission[] }) {
  const [sortCol, setSortCol] = useState<TableSortCol>("created_at");
  const [sortDir, setSortDir] = useState<TableSortDir>("desc");

  function toggleSort(col: TableSortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  const sorted = [...missions].sort((a, b) => {
    let cmp = 0;
    if (sortCol === "status") cmp = a.status.localeCompare(b.status);
    else if (sortCol === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    else if (sortCol === "assigned_to") cmp = a.assigned_to.localeCompare(b.assigned_to);
    else if (sortCol === "started_at") cmp = elapsedMs(b.started_at) - elapsedMs(a.started_at);
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIcon({ col }: { col: TableSortCol }) {
    if (sortCol !== col) return <span className="opacity-30">↕</span>;
    return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function ThBtn({ col, children }: { col: TableSortCol; children: React.ReactNode }) {
    return (
      <th
        className="cursor-pointer select-none px-3 py-2 text-left font-[family-name:var(--font-space-grotesk)] text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => toggleSort(col)}
      >
        <span className="flex items-center gap-1">
          {children} <SortIcon col={col} />
        </span>
      </th>
    );
  }

  return (
    <StealthCard className="overflow-hidden" hover={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <ThBtn col="status">Status</ThBtn>
              <th className="px-3 py-2 text-left font-[family-name:var(--font-space-grotesk)] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Title
              </th>
              <ThBtn col="assigned_to">Agent</ThBtn>
              <th className="px-3 py-2 text-left font-[family-name:var(--font-space-grotesk)] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Objective
              </th>
              <ThBtn col="started_at">Duration</ThBtn>
              <ThBtn col="created_at">Created</ThBtn>
              <th className="px-3 py-2 text-right font-[family-name:var(--font-space-grotesk)] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((mission, idx) => {
              const dotClass = STATUS_DOT[mission.status] ?? "bg-muted-foreground";
              const duration = formatDuration(mission.started_at, mission.completed_at);
              return (
                <tr
                  key={mission.id}
                  className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${idx % 2 === 0 ? "" : "bg-muted/5"}`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 flex-shrink-0 rounded-full ${dotClass}`} />
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground capitalize">
                        {mission.status}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-xs px-3 py-2.5">
                    <Link
                      href={`/missions/${mission.id}`}
                      className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-foreground hover:text-foreground/80 transition-colors truncate block"
                    >
                      {mission.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/agents/${mission.assigned_to}`}
                      className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-emerald-400/80 hover:text-emerald-400 transition-colors"
                    >
                      {mission.assigned_to}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground/60">
                      —
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-muted-foreground">
                      {duration ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tabular-nums text-muted-foreground/60">
                      {formatTimestamp(mission.created_at)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/missions/${mission.id}`}
                      className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      view →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground/50">
              No missions found.
            </p>
          </div>
        )}
      </div>
    </StealthCard>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("kanban");
  const [clearingFailed, setClearingFailed] = useState(false);

  // Persist view mode in localStorage
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null;
    if (stored === "kanban" || stored === "table") setView(stored);
  }, []);

  function changeView(v: ViewMode) {
    setView(v);
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  }

  const fetchData = useCallback(async () => {
    const data = await getMissions();
    setMissions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function clearFailed() {
    setClearingFailed(true);
    try {
      const res = await fetch("/api/missions/archive", { method: "POST" });
      if (res.ok) {
        setMissions((prev) => prev.filter((m) => m.status !== "failed"));
      }
    } finally {
      setClearingFailed(false);
    }
  }

  if (!supabase) {
    return (
      <div className="flex h-screen flex-col bg-background p-4">
        <div className="flex h-full items-center justify-center">
          <StealthCard className="max-w-md p-8 text-center">
            <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-foreground">
              Connect Supabase to see live data
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Add these environment variables to your{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs">
                .env.local
              </code>{" "}
              file:
            </p>
            <div className="rounded-sm bg-muted/50 p-4 text-left font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground">
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
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground">
          Loading missions...
        </p>
      </div>
    );
  }

  // Counts for filter pills
  const counts: Record<FilterStatus, number> = {
    all:       missions.length,
    queued:    missions.filter((m) => m.status === "queued").length,
    running:   missions.filter((m) => m.status === "running").length,
    completed: missions.filter((m) => m.status === "completed").length,
    failed:    missions.filter((m) => m.status === "failed").length,
    stale:     missions.filter((m) => m.status === "stale").length,
  };

  // Apply filter then sort
  const filtered = filter === "all" ? missions : missions.filter((m) => m.status === filter);
  const sorted = sortMissions(filtered, sort);

  // For Kanban, further split into columns (only the 5 primary columns)
  // When a filter is active and view is kanban, show only matching column(s)
  const kanbanMissions = (status: KanbanStatus) =>
    sortMissions(
      missions.filter(
        (m) => m.status === status && (filter === "all" || filter === status)
      ),
      sort
    );

  const hasFailedMissions = missions.some((m) => m.status === "failed");

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-7xl space-y-4">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/dashboard" className="transition-colors hover:text-foreground">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-foreground/60">Missions</span>
        </nav>

        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-foreground">
              Missions
            </h1>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-muted-foreground/75">
              {filtered.length} mission{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Clear failed */}
            {hasFailedMissions && (
              <button
                onClick={clearFailed}
                disabled={clearingFailed}
                className="rounded-sm border border-red-500/20 bg-red-500/10 px-3 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                {clearingFailed ? "clearing..." : "Clear failed"}
              </button>
            )}

            {/* Sort dropdown */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-sm border border-border bg-background px-2.5 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="longest">Longest running</option>
            </select>

            {/* View toggle */}
            <div className="flex rounded-sm border border-border overflow-hidden">
              <button
                onClick={() => changeView("kanban")}
                className={`px-3 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs transition-colors ${
                  view === "kanban"
                    ? "bg-muted text-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                Kanban
              </button>
              <button
                onClick={() => changeView("table")}
                className={`px-3 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs transition-colors border-l border-border ${
                  view === "table"
                    ? "bg-muted text-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => {
            const isActive = filter === option;
            const count = counts[option];

            // Hide filters with 0 count (except "all" and active filter)
            if (count === 0 && option !== "all" && !isActive) return null;

            const colorMap: Record<string, string> = {
              all:       "border-border text-muted-foreground",
              queued:    "border-blue-500/30 text-blue-400",
              running:   "border-amber-500/30 text-amber-400",
              completed: "border-green-500/30 text-green-400",
              failed:    "border-red-500/30 text-red-400",
              stale:     "border-yellow-500/30 text-yellow-400",
            };
            const activeBgMap: Record<string, string> = {
              all:       "bg-muted",
              queued:    "bg-blue-500/10",
              running:   "bg-amber-500/10",
              completed: "bg-green-500/10",
              failed:    "bg-red-500/10",
              stale:     "bg-yellow-500/10",
            };

            return (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs transition-all ${
                  isActive
                    ? `${activeBgMap[option] ?? "bg-muted"} ${colorMap[option] ?? "text-muted-foreground"}`
                    : "border-border/50 bg-transparent text-muted-foreground/50 hover:text-muted-foreground"
                }`}
              >
                {option !== "all" && (
                  <span
                    className={`inline-block size-1.5 rounded-full ${
                      {
                        queued:    "bg-blue-500",
                        running:   "bg-amber-500",
                        completed: "bg-green-500",
                        failed:    "bg-red-500",
                        stale:     "bg-yellow-500",
                      }[option] ?? "bg-muted-foreground"
                    }`}
                  />
                )}
                {option}
                <span className="ml-0.5 tabular-nums opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Views */}
        {view === "kanban" ? (
          <motion.div
            className="flex gap-3 overflow-x-auto pb-4"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            key={`kanban-${filter}-${sort}`}
          >
            {KANBAN_COLUMNS.filter(
              (col) => filter === "all" || filter === col.key
            ).map((col) => (
              <motion.div
                key={col.key}
                variants={staggerItem}
                className="min-w-[200px] flex-1"
              >
                <KanbanColumn
                  column={col}
                  missions={kanbanMissions(col.key)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            key={`table-${filter}-${sort}`}
          >
            <TableView missions={sorted} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
