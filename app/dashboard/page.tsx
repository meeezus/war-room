"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { EngineStatus, OutcomeCard, ServiceHealthResponse, SystemFitness } from "@/lib/types";
import { SidebarNav } from "@/components/sidebar-nav";
import { EventRail } from "@/components/event-rail";
import { StealthCard } from "@/components/stealth-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { OuraBar } from "@/components/widgets/oura-bar";
import { ResearchCard, AeonCard, OpsecCard, MessagesCard } from "@/components/outcomes";
import { LearningsFeed } from "@/components/outcomes/learnings-feed";
import { SystemHealthAccordion } from "@/components/widgets/system-health-accordion";
import { FleetStatus } from "@/components/widgets/fleet-status";
import { getDashboardCounts, getRecentSessions, getRecentLogs, getOutcomeCounts } from "@/lib/queries";

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
  const [outcomes, setOutcomes] = useState<Record<string, OutcomeCard> | null>(null);
  const [health, setHealth] = useState<ServiceHealthResponse | null>(null);
  const [fitness, setFitness] = useState<SystemFitness | null>(null);
  const [insights, setInsights] = useState<{ content: string; created_at: string; id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    setCurrentTime(fmt());
    const timer = setInterval(() => setCurrentTime(fmt()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async (initial = false) => {
    try {
      const [statusRes, countsData, sessionsData, logsData, outcomesData] = await Promise.all([
        fetch("/api/engine-status").then((r) => r.json()),
        getDashboardCounts(),
        getRecentSessions(8),
        getRecentLogs(8),
        getOutcomeCounts(),
      ]);
      setEngineStatus(statusRes);
      setCounts(countsData);
      setSessions(sessionsData as Session[]);
      setLogs(logsData as LogEntry[]);
      setOutcomes(outcomesData);

      // Separate fetch for local-only APIs (may fail on Vercel, wrap in try/catch)
      try {
        const [healthRes, memoryRes] = await Promise.all([
          fetch("/api/services/health").then((r) => r.json()),
          fetch("/api/memory/status").then((r) => r.json()),
        ]);
        setHealth(healthRes);
        if (memoryRes.fitness) setFitness(memoryRes.fitness);
        if (memoryRes.insights) setInsights(memoryRes.insights);
      } catch {
        // Local APIs unavailable (Vercel) — health/fitness stay null
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Auto-refresh every 30 seconds (no loading flash)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
          <OuraBar />
          <span className="text-muted-foreground/40">·</span>
          <ThemeToggle />
          <span className="text-muted-foreground/40">{currentTime}</span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Outcome Cards - 2x2 grid */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <ResearchCard data={outcomes?.research ?? null} />
              <AeonCard data={outcomes?.aeon ?? null} />
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <OpsecCard data={outcomes?.opsec ?? null} />
              <MessagesCard data={outcomes?.messages ?? null} unreadCount={outcomes?.messages?.count} />
            </div>

            {/* Learnings Feed */}
            <div className="mb-4">
              <LearningsFeed fitness={fitness} insights={insights} />
            </div>

            {/* Fleet Status */}
            <div className="mb-4">
              <FleetStatus
                agentsOnline={counts.agentsOnline}
                tasksRunning={counts.tasksRunning}
                errors24h={counts.errors24h}
                activeSessions={counts.activeSessions}
              />
            </div>

            {/* System Health Accordion */}
            <div className="mb-4">
              <SystemHealthAccordion health={health} />
            </div>
          </div>

          {/* Right Event Rail */}
          <EventRail />
        </div>

      </div>
    </div>
  );
}
