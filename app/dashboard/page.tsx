"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getAgents, getMissions, getEvents, getStats, getProjectsWithMetrics, getDynastyStats, getMissionStats } from "@/lib/queries";
import type { AgentStatus, Mission, Event, DashboardStats, DynastyStats, ProjectWithMetrics } from "@/lib/types";
import Link from "next/link";
import { StatsBar } from "@/components/stats-bar";
import { AgentSidebar } from "@/components/agent-sidebar";
import { EventFeed } from "@/components/event-feed";
import { StealthCard } from "@/components/stealth-card";
import { ProjectOverview } from "@/components/project-overview";


const defaultStats: DashboardStats = {
  activeAgents: 0,
  inProgressTasks: 0,
  pendingReviews: 0,
  pendingProposals: 0,
};

const defaultDynastyStats: DynastyStats = {
  totalProjects: 0,
  activeProjects: 0,
  totalTasks: 0,
  activeTasks: 0,
};

function ConnectPrompt() {
  return (
    <div className="flex h-full items-center justify-center">
      <StealthCard className="max-w-md p-8 text-center">
        <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-[#E5E5E5]">
          Connect Supabase to see live data
        </h2>
        <p className="mb-4 text-sm text-[rgba(255,255,255,0.5)]">
          Add these environment variables to your <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs">.env.local</code> file:
        </p>
        <div className="rounded-sm bg-white/[0.04] p-4 text-left font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.5)]">
          <p>NEXT_PUBLIC_SUPABASE_URL=your-url</p>
          <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key</p>
        </div>
        <p className="mt-4 text-xs text-[rgba(255,255,255,0.3)]">
          Then restart the dev server.
        </p>
      </StealthCard>
    </div>
  );
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [projects, setProjects] = useState<ProjectWithMetrics[]>([]);
  const [dynastyStats, setDynastyStats] = useState<DynastyStats>(defaultDynastyStats);
  const [missionStats, setMissionStats] = useState({ active: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [feedOpen, setFeedOpen] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [agentsData, missionsData, eventsData, statsData, projectsData, dynastyData, missionStatsData] = await Promise.all([
        getAgents(),
        getMissions(),
        getEvents(),
        getStats(),
        getProjectsWithMetrics(),
        getDynastyStats(),
        getMissionStats(),
      ]);
      setAgents(agentsData);
      setMissions(missionsData);
      setEvents(eventsData);
      setStats(statsData);
      setProjects(projectsData);
      setDynastyStats(dynastyData);
      setMissionStats(missionStatsData);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (!supabase) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background p-4">
        <div className="mb-4 flex-shrink-0">
          <div className="mb-3 flex items-baseline gap-3">
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold tracking-tight text-[#E5E5E5]">
              War Room
            </h1>
            <span className="text-xs text-[rgba(255,255,255,0.4)]">
              Shogunate Command Center
            </span>
          </div>
        </div>
        <ConnectPrompt />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-[rgba(255,255,255,0.4)]">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background p-4">
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold tracking-tight text-[#E5E5E5]">
            War Room
          </h1>
          <span className="hidden sm:inline text-xs text-[rgba(255,255,255,0.4)]">
            Dynasty Command Center
          </span>
          <span className="ml-auto flex items-center gap-3">
            <Link href="/dojo" className="hidden sm:inline font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.4)] hover:text-emerald-400 transition-colors">
              🥷 Dojo
            </Link>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[rgba(255,255,255,0.3)]">
              {dynastyStats.activeProjects}/{dynastyStats.totalProjects} projects
              {" \u00B7 "}
              <Link href="/missions" className="transition-colors hover:text-[rgba(255,255,255,0.6)]">
                {missionStats.active}/{missionStats.total} missions
              </Link>
              {" \u00B7 "}
              {dynastyStats.activeTasks}/{dynastyStats.totalTasks} tasks
            </span>
          </span>
        </div>
        <StatsBar stats={stats} />
      </div>

      {/* Mobile nav */}
      <div className="flex gap-2 mb-3 sm:hidden">
        <Link href="/dojo" className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-center text-xs font-medium text-zinc-300 hover:bg-zinc-800">
          🥷 Dojo
        </Link>
        <Link href="/chat" className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-center text-xs font-medium text-zinc-300 hover:bg-zinc-800">
          💬 Chat
        </Link>
        <Link href="/missions" className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-center text-xs font-medium text-zinc-300 hover:bg-zinc-800">
          🎯 Missions
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left - Agent Sidebar (hidden on mobile) */}
        <div className={`hidden sm:block transition-all duration-150 flex-shrink-0 overflow-hidden ${sidebarOpen ? "w-64" : "w-10"}`}>
          {sidebarOpen ? (
            <div className="flex h-full flex-col">
              <div className="mb-2 flex h-6 items-center justify-between">
                <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
                  Daimyo Council
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-[rgba(255,255,255,0.4)] font-[family-name:var(--font-space-grotesk)] text-xs hover:text-[rgba(255,255,255,0.6)]"
                >
                  &laquo;
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <AgentSidebar agents={agents} />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-full w-10 flex-col items-center pt-2 text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)]"
            >
              <span className="font-[family-name:var(--font-space-grotesk)] text-xs [writing-mode:vertical-rl]">DC</span>
              <span className="mt-2 font-[family-name:var(--font-space-grotesk)] text-xs">&raquo;</span>
            </button>
          )}
        </div>

        {/* Center - Project Overview */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="mb-2 flex h-6 items-center">
            <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
              Projects
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <ProjectOverview projects={projects} />
          </div>
        </div>

        {/* Right - Event Feed (hidden on mobile) */}
        <div className={`hidden sm:block transition-all duration-150 flex-shrink-0 overflow-hidden ${feedOpen ? "w-80" : "w-10"}`}>
          {feedOpen ? (
            <div className="flex h-full flex-col">
              <div className="mb-2 flex h-6 items-center justify-between">
                <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
                  Event Feed
                </span>
                <button
                  onClick={() => setFeedOpen(false)}
                  className="text-[rgba(255,255,255,0.4)] font-[family-name:var(--font-space-grotesk)] text-xs hover:text-[rgba(255,255,255,0.6)]"
                >
                  &raquo;
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <EventFeed events={events} />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setFeedOpen(true)}
              className="flex h-full w-10 flex-col items-center pt-2 text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)]"
            >
              <span className="font-[family-name:var(--font-space-grotesk)] text-xs [writing-mode:vertical-rl]">EF</span>
              <span className="mt-2 font-[family-name:var(--font-space-grotesk)] text-xs">&laquo;</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
