"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { EngineStatus } from "@/lib/types";
import { SidebarNav } from "@/components/sidebar-nav";
import { StatCard } from "@/components/stat-card";
import { EventRail } from "@/components/event-rail";
import { StealthCard } from "@/components/stealth-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { getDashboardCounts, getRecentSessions, getRecentLogs } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Session = {
  id: string;
  title: string;
  assigned_to: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
};

type LogEntry = {
  id: string;
  event_type: string;
  title: string;
  created_at: string;
};

type Counts = {
  activeSessions: number;
  agentsOnline: number;
  tasksRunning: number;
  errors24h: number;
};

function statusDot(status: string) {
  if (status === "running" || status === "in_progress") return "bg-green-500";
  if (status === "failed") return "bg-red-500";
  if (status === "completed") return "bg-blue-500";
  return "bg-muted-foreground/40";
}

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ConnectPrompt() {
  return (
    <div className="flex h-full items-center justify-center">
      <StealthCard className="max-w-md p-8 text-center">
        <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold">
          Connect Supabase to see live data
        </h2>
        <p className="text-sm text-muted-foreground">
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local
        </p>
      </StealthCard>
    </div>
  );
}

export default function DashboardPage() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [counts, setCounts] = useState<Counts>({ activeSessions: 0, agentsOnline: 0, tasksRunning: 0, errors24h: 0 });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    setCurrentTime(fmt());
    const timer = setInterval(() => setCurrentTime(fmt()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statusRes, countsData, sessionsData, logsData] = await Promise.all([
          fetch("/api/engine-status").then((r) => r.json()),
          getDashboardCounts(),
          getRecentSessions(8),
          getRecentLogs(8),
        ]);
        setEngineStatus(statusRes);
        setCounts(countsData);
        setSessions(sessionsData as Session[]);
        setLogs(logsData as LogEntry[]);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (!supabase) {
    return (
      <div className="flex h-screen bg-background">
        <SidebarNav />
        <div className="flex-1">
          <ConnectPrompt />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground">
          Loading...
        </p>
      </div>
    );
  }

  const healthVariant =
    engineStatus?.health === "nominal"
      ? "success"
      : engineStatus?.health === "degraded"
      ? "warning"
      : "danger";

  const authorityDomains = engineStatus?.authority?.domains
    ? Object.entries(engineStatus.authority.domains)
    : [];

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <SidebarNav />

      {/* Main Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="flex h-10 flex-shrink-0 items-center gap-4 border-b border-border/50 px-5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_6px] shadow-green-500" />
          <span>Engine Live</span>
          <span className="text-muted-foreground/40">·</span>
          <span>
            Cycle{" "}
            <span className="text-amber-500">
              {Math.round((engineStatus?.avgCycleMs || 0) / 1000)}s
            </span>
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>Gateway 198ms</span>
          <span className="flex-1" />
          <ThemeToggle />
          <span className="text-muted-foreground/40">{currentTime}</span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Stat Cards Row */}
            <div className="mb-4 grid grid-cols-4 gap-3">
              <Link href="/sessions" className="block">
                <StatCard
                  label="Active Sessions"
                  value={counts.activeSessions}
                  subtext="missions running"
                  variant={counts.activeSessions > 0 ? "success" : "default"}
                />
              </Link>
              <Link href="/agents" className="block">
                <StatCard
                  label="Agents Online"
                  value={counts.agentsOnline}
                  subtext="not offline"
                  variant={counts.agentsOnline > 0 ? "success" : "default"}
                />
              </Link>
              <Link href="/tasks" className="block">
                <StatCard
                  label="Tasks Running"
                  value={counts.tasksRunning}
                  subtext="in progress"
                  variant={counts.tasksRunning > 0 ? "default" : "default"}
                />
              </Link>
              <Link href="/missions" className="block">
                <StatCard
                  label="Errors (24h)"
                  value={counts.errors24h}
                  subtext="failed missions"
                  variant="danger"
                />
              </Link>
            </div>

            {/* 3-Column Panel Row */}
            <div className="mb-4 grid grid-cols-3 gap-3">
              {/* System Health */}
              <div className="rounded-sm border border-border/50 bg-card p-3">
                <div className="mb-2 border-b border-border/50 pb-2 font-[family-name:var(--font-space-grotesk)] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  System Health
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Supabase</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-green-500">Connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Claude CLI</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-green-500">Available</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Avg Cycle</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-amber-500">
                      {Math.round((engineStatus?.avgCycleMs || 0) / 1000)}s
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Budget</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-green-500">OK</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Health</span>
                    <span
                      className={cn(
                        "font-[family-name:var(--font-jetbrains-mono)] text-[10px] capitalize",
                        healthVariant === "success" ? "text-green-500" : healthVariant === "warning" ? "text-amber-500" : "text-red-500"
                      )}
                    >
                      {engineStatus?.health || "unknown"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Engine Status */}
              <div className="rounded-sm border border-border/50 bg-card p-3">
                <div className="mb-2 border-b border-border/50 pb-2 font-[family-name:var(--font-space-grotesk)] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Engine Status
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Wins (24h)</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-green-500">
                      {engineStatus?.wins?.length ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Failures (24h)</span>
                    <span className={cn("font-[family-name:var(--font-jetbrains-mono)] text-[10px]", (engineStatus?.failures?.length ?? 0) > 0 ? "text-red-500" : "text-green-500")}>
                      {engineStatus?.failures?.length ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Stalled</span>
                    <span className={cn("font-[family-name:var(--font-jetbrains-mono)] text-[10px]", (engineStatus?.stalledObjectives?.length ?? 0) > 0 ? "text-amber-500" : "text-muted-foreground/60")}>
                      {engineStatus?.stalledObjectives?.length ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">With Root Cause</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/60">
                      {engineStatus?.failures?.filter((f) => f.rootCause).length ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Authority */}
              <div className="rounded-sm border border-border/50 bg-card p-3">
                <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Authority
                  </span>
                  <span
                    className={cn(
                      "font-[family-name:var(--font-jetbrains-mono)] text-[10px]",
                      engineStatus?.authority?.enabled ? "text-green-500" : "text-muted-foreground/60"
                    )}
                  >
                    {engineStatus?.authority?.enabled ? "enabled" : "disabled"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {authorityDomains.length === 0 && (
                    <div className="text-[11px] text-muted-foreground/60">
                      No domain data yet. Authority tracks agent success rates per domain to auto-approve trusted work.
                    </div>
                  )}
                  {authorityDomains.slice(0, 4).map(([domain, info]) => (
                    <div key={domain} className="flex items-center justify-between">
                      <span className="text-[11px] capitalize text-muted-foreground">{domain}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/60">
                          {info.tier === "auto-approve" ? "auto" : "propose"}
                        </span>
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-green-500">
                          {Math.round(info.successRate * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2-Column Bottom Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Recent Sessions */}
              <div className="rounded-sm border border-border/50 bg-card p-3">
                <div className="mb-2 border-b border-border/50 pb-2 font-[family-name:var(--font-space-grotesk)] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent Sessions
                </div>
                <div className="space-y-1">
                  {sessions.length === 0 && (
                    <div className="text-[11px] text-muted-foreground/60">No sessions</div>
                  )}
                  {sessions.map((s) => (
                    <Link
                      key={s.id}
                      href={`/missions/${s.id}`}
                      className="flex items-center gap-2 rounded px-1 py-1 transition-colors hover:bg-muted/30"
                    >
                      <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", statusDot(s.status))} />
                      <span className="flex-1 truncate text-[11px]">{s.title || s.id.slice(0, 8)}</span>
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/60">
                        {s.assigned_to || "—"}
                      </span>
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/40">
                        {relativeTime(s.started_at || s.completed_at)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent Logs */}
              <div className="rounded-sm border border-border/50 bg-card p-3">
                <div className="mb-2 border-b border-border/50 pb-2 font-[family-name:var(--font-space-grotesk)] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent Logs
                </div>
                <div className="space-y-1">
                  {logs.length === 0 && (
                    <div className="text-[11px] text-muted-foreground/60">No log entries</div>
                  )}
                  {logs.map((l) => (
                    <Link
                      key={l.id}
                      href="/events"
                      className="flex items-center gap-2 rounded px-1 py-1 transition-colors hover:bg-muted/30"
                    >
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/50">
                        {l.event_type}
                      </span>
                      <span className="flex-1 truncate text-[11px] text-muted-foreground/80">{l.title || "—"}</span>
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/40">
                        {relativeTime(l.created_at)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Event Rail */}
          <EventRail />
        </div>

      </div>
    </div>
  );
}
