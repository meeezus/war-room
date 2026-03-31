"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { SidebarNav } from "@/components/sidebar-nav";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";

type HeartbeatEvent = {
  id: string;
  event_type: string;
  title: string;
  created_at: string;
  metadata: {
    cycle_duration_ms?: number;
    new_missions?: number;
    task_executed?: boolean;
    stale_detected?: number;
    triggers_fired?: number;
    awareness_proposals?: number;
    idle_cycles?: number;
    budget_ok?: boolean;
    steps_run?: string[];
  } | null;
};

type CronJob = {
  id: string;
  name: string;
  source: "openclaw" | "crontab" | "launchagent";
  schedule: string;
  enabled: boolean;
  description: string;
  lastStatus?: string;
  lastRun?: string;
  sessionTarget?: string;
  pid?: number;
};

type CronData = {
  openclaw: CronJob[];
  crontab: CronJob[];
  launchagents: CronJob[];
  total: number;
};

function getHealthBadge(lastHeartbeat: Date | null) {
  if (!lastHeartbeat) return { label: "Down", color: "text-red-400", dot: "bg-red-500" };
  const ageMin = (Date.now() - lastHeartbeat.getTime()) / 60000;
  if (ageMin < 10) return { label: "Nominal", color: "text-emerald-400", dot: "bg-emerald-500" };
  if (ageMin < 30) return { label: "Degraded", color: "text-amber-400", dot: "bg-amber-500" };
  return { label: "Down", color: "text-red-400", dot: "bg-red-500" };
}

function barColor(durationMs: number): string {
  const s = durationMs / 1000;
  if (s < 60) return "bg-emerald-500";
  if (s < 120) return "bg-amber-500";
  return "bg-red-500";
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

/** Summarize why a cycle was long based on heartbeat metadata */
function cycleContext(meta: HeartbeatEvent["metadata"]): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (meta.new_missions && meta.new_missions > 0) parts.push(`${meta.new_missions} mission${meta.new_missions > 1 ? "s" : ""}`);
  if (meta.task_executed) parts.push("task executed");
  if (meta.triggers_fired && meta.triggers_fired > 0) parts.push(`${meta.triggers_fired} trigger${meta.triggers_fired > 1 ? "s" : ""}`);
  if (meta.awareness_proposals && meta.awareness_proposals > 0) parts.push(`${meta.awareness_proposals} awareness`);
  if (meta.stale_detected && meta.stale_detected > 0) parts.push(`${meta.stale_detected} stale`);
  return parts.length > 0 ? parts.join(", ") : null;
}

function sourceColor(source: string) {
  if (source === "openclaw") return "text-purple-400 bg-purple-500/10 border-purple-500/20";
  if (source === "crontab") return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  return "text-amber-400 bg-amber-500/10 border-amber-500/20";
}

function sourceLabel(source: string) {
  if (source === "openclaw") return "OpenClaw";
  if (source === "crontab") return "Crontab";
  return "Service";
}

function statusDot(status?: string) {
  if (status === "ok" || status === "running") return "bg-emerald-500";
  if (status === "error") return "bg-red-500";
  return "bg-muted-foreground/30";
}

export default function CronPage() {
  const [heartbeats, setHeartbeats] = useState<HeartbeatEvent[]>([]);
  const [cronData, setCronData] = useState<CronData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "openclaw" | "crontab" | "launchagent">("all");

  useEffect(() => {
    const promises: Promise<void>[] = [];

    // Fetch heartbeats
    if (supabase) {
      promises.push(
        supabase
          .from("war_room_events")
          .select("id, event_type, title, created_at, metadata")
          .eq("event_type", "heartbeat")
          .order("created_at", { ascending: false })
          .limit(30)
          .then(({ data }) => {
            setHeartbeats((data as HeartbeatEvent[]) ?? []);
          }) as Promise<void>
      );
    }

    // Fetch all cron jobs
    promises.push(
      fetch("/api/cron/jobs")
        .then((r) => r.json())
        .then((data) => setCronData(data))
        .catch(() => {})
    );

    Promise.all(promises).finally(() => setLoading(false));
  }, []);

  const lastHeartbeat = heartbeats[0] ? new Date(heartbeats[0].created_at) : null;
  const health = getHealthBadge(lastHeartbeat);

  const durations = heartbeats.map((h) => h.metadata?.cycle_duration_ms ?? 0).filter((d) => d > 0);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 1;

  const allJobs = cronData
    ? [
        ...cronData.openclaw,
        ...cronData.crontab,
        ...cronData.launchagents,
      ].filter((j) => activeTab === "all" || j.source === activeTab)
    : [];

  return (
    <div className="flex h-screen bg-background text-foreground">
      <SidebarNav />
      <div className="flex-1 overflow-y-auto p-4 pt-14 sm:p-6 lg:pt-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold tracking-tight mb-1">
            Scheduled Jobs
          </h1>
          <p className="text-[11px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
            {cronData ? `${cronData.total} jobs` : "Loading..."} across OpenClaw, crontab, and system services
          </p>
        </div>

        {loading ? (
          <div className="text-[12px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
            Loading...
          </div>
        ) : (
          <>
            {/* Poller Status Row */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded border border-border/40 bg-card/30 p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] mb-1">
                  Poller Heartbeat
                </p>
                <p className="text-[13px] font-[family-name:var(--font-jetbrains-mono)] font-medium">
                  {lastHeartbeat ? relativeTime(lastHeartbeat.toISOString()) : "—"}
                </p>
              </div>
              <div className="rounded border border-border/40 bg-card/30 p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] mb-1">
                  Avg Cycle
                </p>
                <p className="text-[13px] font-[family-name:var(--font-jetbrains-mono)] font-medium">
                  {avgDuration != null ? `${(avgDuration / 1000).toFixed(1)}s` : "—"}
                </p>
              </div>
              <div className="rounded border border-border/40 bg-card/30 p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] mb-1">
                  Health
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={cn("h-2 w-2 rounded-full", health.dot)}
                    style={{
                      boxShadow:
                        health.label === "Nominal"
                          ? "0 0 6px #22c55e"
                          : health.label === "Degraded"
                          ? "0 0 6px #f59e0b"
                          : "0 0 6px #ef4444",
                    }}
                  />
                  <span className={cn("text-[13px] font-[family-name:var(--font-jetbrains-mono)] font-medium", health.color)}>
                    {health.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Heartbeat Timeline */}
            <div className="rounded border border-border/40 bg-card/30 p-4 mb-6">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] mb-3">
                Cycle Duration Timeline
              </p>
              {heartbeats.length === 0 ? (
                <p className="text-[11px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                  No heartbeat events found
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-end gap-[2px] h-16">
                    {[...heartbeats].reverse().map((hb) => {
                      const dur = hb.metadata?.cycle_duration_ms ?? 0;
                      const heightPct = maxDuration > 0 ? (dur / maxDuration) * 100 : 0;
                      const ctx = cycleContext(hb.metadata);
                      const tooltip = `${relativeTime(hb.created_at)}: ${dur > 0 ? `${(dur / 1000).toFixed(1)}s` : "no data"}${ctx ? ` (${ctx})` : ""}`;
                      return (
                        <div
                          key={hb.id}
                          className="flex-1 min-w-0 group relative"
                          style={{ height: "100%", display: "flex", alignItems: "flex-end" }}
                        >
                          <div
                            className={cn(
                              "w-full rounded-sm transition-opacity group-hover:opacity-80",
                              dur > 0 ? barColor(dur) : "bg-muted/30"
                            )}
                            style={{ height: dur > 0 ? `${Math.max(heightPct, 8)}%` : "8%" }}
                            title={tooltip}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[9px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                      {heartbeats.length > 0 ? relativeTime(heartbeats[heartbeats.length - 1].created_at) : ""}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                      {heartbeats.length > 0 ? relativeTime(heartbeats[0].created_at) : ""}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1">
                    {[
                      ["bg-emerald-500", "<60s"],
                      ["bg-amber-500", "<120s"],
                      ["bg-red-500", ">120s"],
                    ].map(([bg, label]) => (
                      <div key={label} className="flex items-center gap-1">
                        <span className={cn("h-2 w-2 rounded-sm inline-block", bg)} />
                        <span className="text-[10px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Cycles with Context */}
            <div className="rounded border border-border/40 bg-card/30 p-4 mb-6">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] mb-3">
                Recent Cycles
              </p>
              <table className="w-full text-[11px] font-[family-name:var(--font-jetbrains-mono)]">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground pb-2 pr-4 font-normal">Time</th>
                    <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground pb-2 pr-4 font-normal">Activity</th>
                    <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground pb-2 font-normal">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {heartbeats.slice(0, 15).map((hb) => {
                    const dur = hb.metadata?.cycle_duration_ms;
                    const ctx = cycleContext(hb.metadata);
                    return (
                      <tr key={hb.id} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                        <td className="py-1.5 pr-4 text-muted-foreground whitespace-nowrap">
                          {relativeTime(hb.created_at)}
                        </td>
                        <td className="py-1.5 pr-4">
                          {ctx ? (
                            <span className="text-foreground/80">{ctx}</span>
                          ) : (
                            <span className="text-muted-foreground/40">idle</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right whitespace-nowrap">
                          {dur != null ? (
                            <span className={cn(
                              dur / 1000 < 60 ? "text-emerald-400" : dur / 1000 < 120 ? "text-amber-400" : "text-red-400"
                            )}>
                              {(dur / 1000).toFixed(1)}s
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* All Scheduled Jobs */}
            <div className="rounded border border-border/40 bg-card/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                  All Scheduled Jobs
                </p>
                <div className="flex gap-1">
                  {(["all", "openclaw", "crontab", "launchagent"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-[family-name:var(--font-jetbrains-mono)] transition-colors",
                        activeTab === tab
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {tab === "all" ? `All (${cronData?.total ?? 0})` : tab === "openclaw" ? `OpenClaw (${cronData?.openclaw.length ?? 0})` : tab === "crontab" ? `Crontab (${cronData?.crontab.length ?? 0})` : `Services (${cronData?.launchagents.length ?? 0})`}
                    </button>
                  ))}
                </div>
              </div>

              {allJobs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                  No jobs found
                </p>
              ) : (
                <div className="space-y-1">
                  {allJobs.map((job) => (
                    <div key={job.id}>
                      <button
                        onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                        className="w-full flex items-center gap-3 rounded px-2 py-2 hover:bg-muted/20 transition-colors text-left"
                      >
                        <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", statusDot(job.lastStatus))} />
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 font-[family-name:var(--font-jetbrains-mono)]",
                          sourceColor(job.source)
                        )}>
                          {sourceLabel(job.source)}
                        </span>
                        <span className="flex-1 text-[11px] truncate">{job.name}</span>
                        <span className="text-[10px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] flex-shrink-0">
                          {job.schedule}
                        </span>
                        {job.sessionTarget && job.sessionTarget !== "main" && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-[family-name:var(--font-jetbrains-mono)]">
                            {job.sessionTarget}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/40">
                          {expandedJob === job.id ? "▾" : "▸"}
                        </span>
                      </button>
                      {expandedJob === job.id && (
                        <div className="ml-8 mr-2 mb-2 p-3 rounded bg-muted/10 border border-border/20">
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {job.description}
                          </p>
                          <div className="flex gap-4 mt-2 text-[10px] font-[family-name:var(--font-jetbrains-mono)] text-muted-foreground/60">
                            {job.lastRun && <span>Last run: {relativeTime(job.lastRun)}</span>}
                            {job.lastStatus && <span>Status: {job.lastStatus}</span>}
                            {job.pid && <span>PID: {job.pid}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
