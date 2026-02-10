"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getAgents, getMissions, getEvents, getStats, getProjects, getDynastyStats } from "@/lib/queries";
import type { AgentStatus, Mission, Event, DashboardStats, Project, DynastyStats } from "@/lib/types";
import { StatsBar } from "@/components/stats-bar";
import { AgentSidebar } from "@/components/agent-sidebar";
import { EventFeed } from "@/components/event-feed";
import { StealthCard } from "@/components/stealth-card";
import { ProjectCard } from "@/components/project-card";
import { useRealtimeProjects } from "@/lib/realtime";

const defaultStats: DashboardStats = {
  activeAgents: 0,
  runningMissions: 0,
  queuedSteps: 0,
  todayProposals: 0,
};

const defaultDynastyStats: DynastyStats = {
  totalProjects: 0,
  activeProjects: 0,
  totalTasks: 0,
  activeTasks: 0,
};

const KANBAN_COLUMNS: { key: string; label: string; statuses: string[]; accent: string }[] = [
  { key: "queued", label: "Queued", statuses: ["todo", "someday"], accent: "#6b7280" },
  { key: "running", label: "Running", statuses: ["inprogress"], accent: "#3b82f6" },
  { key: "completed", label: "Completed", statuses: ["done"], accent: "#10b981" },
  { key: "failed", label: "On Hold", statuses: ["onhold"], accent: "#eab308" },
];

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

function MissionsKanban({ projects }: { projects: Project[] }) {
  const liveProjects = useRealtimeProjects(projects);

  return (
    <div className="flex h-full gap-3">
      {KANBAN_COLUMNS.map((col) => {
        const cards = liveProjects.filter((p) =>
          col.statuses.includes(p.status)
        );
        return (
          <div key={col.key} className="flex min-w-0 flex-1 flex-col">
            {/* Column header */}
            <div className="mb-2 flex items-center gap-2 px-1">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: col.accent }}
              />
              <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.5)]">
                {col.label}
              </span>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tabular-nums text-[rgba(255,255,255,0.3)]">
                {cards.length}
              </span>
            </div>
            {/* Cards */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {cards.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dynastyStats, setDynastyStats] = useState<DynastyStats>(defaultDynastyStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [agentsData, missionsData, eventsData, statsData, projectsData, dynastyData] = await Promise.all([
        getAgents(),
        getMissions(),
        getEvents(),
        getStats(),
        getProjects(),
        getDynastyStats(),
      ]);
      setAgents(agentsData);
      setMissions(missionsData);
      setEvents(eventsData);
      setStats(statsData);
      setProjects(projectsData);
      setDynastyStats(dynastyData);
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
        <div className="mb-3 flex items-baseline gap-3">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold tracking-tight text-[#E5E5E5]">
            War Room
          </h1>
          <span className="text-xs text-[rgba(255,255,255,0.4)]">
            Dynasty Command Center
          </span>
          <span className="ml-auto font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[rgba(255,255,255,0.3)]">
            {dynastyStats.activeProjects}/{dynastyStats.totalProjects} missions
            {" \u00B7 "}
            {dynastyStats.activeTasks}/{dynastyStats.totalTasks} tasks
          </span>
        </div>
        <StatsBar stats={stats} />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left - Agent Sidebar */}
        <div className="w-64 flex-shrink-0 overflow-y-auto">
          <AgentSidebar agents={agents} />
        </div>

        {/* Center - Missions Kanban */}
        <div className="flex-1 overflow-hidden">
          <MissionsKanban projects={projects} />
        </div>

        {/* Right - Event Feed */}
        <div className="w-80 flex-shrink-0">
          <EventFeed events={events} />
        </div>
      </div>
    </div>
  );
}
