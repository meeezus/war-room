"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getAgents, getMissions, getEvents, getProjectsWithMetrics, getDynastyStats, getMissionStats, getPendingDiscoveryCount, getSkillPatchStats, getLastPatrolSummary, getActiveObjectiveCount } from "@/lib/queries";
import type { AgentStatus, Mission, Event, DynastyStats, ProjectWithMetrics } from "@/lib/types";
import Link from "next/link";
import { StatusRibbon } from "@/components/status-ribbon";
import { AgentSidebar } from "@/components/agent-sidebar";
import { EventFeed } from "@/components/event-feed";
import { StealthCard } from "@/components/stealth-card";
import { ProjectOverview } from "@/components/project-overview";
import { CreateProjectModal } from "@/components/create-project-modal";
import { TerminalPanel } from "@/components/terminal/terminal-panel";


const defaultDynastyStats: DynastyStats = {
  totalProjects: 0,
  activeProjects: 0,
  totalTasks: 0,
  activeTasks: 0,
};

function computeSmartPriority(project: ProjectWithMetrics): number {
  // P0: deadline within 3 days and not done
  if (project.target_date) {
    const daysUntil = (new Date(project.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil <= 3 && project.status !== "done") return 0;
  }
  // P1: in progress
  if (project.status === "inprogress") return 1;
  // P2: queued
  if (project.status === "queue") return 2;
  // P3: on hold
  if (project.status === "onhold") return 3;
  // P4: done
  if (project.status === "done") return 4;
  return 2;
}

function applySmartPriority(projects: ProjectWithMetrics[]): ProjectWithMetrics[] {
  return projects
    .map((p) => ({ ...p, priority: computeSmartPriority(p) }))
    .sort((a, b) => a.priority - b.priority);
}

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
  const [skillStats, setSkillStats] = useState({ recentPatches: 0, appliedPatches: 0 });
  const [lastPatrol, setLastPatrol] = useState<{ timestamp: string | null; discoveryCount: number }>({ timestamp: null, discoveryCount: 0 });
  const [activeObjectives, setActiveObjectives] = useState(0);
  const [projects, setProjects] = useState<ProjectWithMetrics[]>([]);
  const [dynastyStats, setDynastyStats] = useState<DynastyStats>(defaultDynastyStats);
  const [missionStats, setMissionStats] = useState({ active: 0, total: 0 });
  const [pendingDiscoveries, setPendingDiscoveries] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [feedOpen, setFeedOpen] = useState(true);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  const refreshProjects = useCallback(async () => {
    const [projectsData, dynastyData] = await Promise.all([
      getProjectsWithMetrics(),
      getDynastyStats(),
    ]);
    setProjects(applySmartPriority(projectsData));
    setDynastyStats(dynastyData);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [agentsData, missionsData, eventsData, projectsData, dynastyData, missionStatsData, discoveryCount, skillStatsData, lastPatrolData, objectiveCount] = await Promise.all([
        getAgents(),
        getMissions(),
        getEvents(),
        getProjectsWithMetrics(),
        getDynastyStats(),
        getMissionStats(),
        getPendingDiscoveryCount(),
        getSkillPatchStats(),
        getLastPatrolSummary(),
        getActiveObjectiveCount(),
      ]);
      setAgents(agentsData);
      setMissions(missionsData);
      setEvents(eventsData);
      setProjects(applySmartPriority(projectsData));
      setDynastyStats(dynastyData);
      setMissionStats(missionStatsData);
      setPendingDiscoveries(discoveryCount);
      setSkillStats(skillStatsData);
      setLastPatrol(lastPatrolData);
      setActiveObjectives(objectiveCount);
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
              Dynasty Tenshu
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
            Dynasty Tenshu
          </h1>
          <span className="text-xs text-[rgba(255,255,255,0.4)]">
            Shogunate Command Center
          </span>
          <span className="ml-auto font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[rgba(255,255,255,0.3)]">
            {dynastyStats.activeProjects}/{dynastyStats.totalProjects} projects
            {" \u00B7 "}
            <Link href="/missions" className="transition-colors hover:text-[rgba(255,255,255,0.6)]">
              {missionStats.active}/{missionStats.total} missions
            </Link>
            {" \u00B7 "}
            {dynastyStats.activeTasks}/{dynastyStats.totalTasks} tasks
            {" \u00B7 "}
            <Link href="/council" className="transition-colors hover:text-[rgba(255,255,255,0.6)]">
              ⚔️ council
            </Link>
            {" \u00B7 "}
            <Link href="/chat" className="transition-colors hover:text-[rgba(255,255,255,0.6)]">
              ⚡ chat
            </Link>
          </span>
          <button
            onClick={() => setCreateProjectOpen(true)}
            className="ml-3 px-2.5 py-1 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
          >
            + Project
          </button>
        </div>
        <StatusRibbon
          pendingDiscoveries={pendingDiscoveries}
          lastPatrol={lastPatrol}
          skillStats={skillStats}
          activeObjectives={activeObjectives}
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left - Agent Sidebar */}
        <div className={`transition-all duration-150 flex-shrink-0 overflow-hidden ${sidebarOpen ? "w-64" : "w-10"}`}>
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
          <div className="mb-2 flex h-6 items-center gap-2">
            <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
              Projects
            </span>
            {pendingDiscoveries > 0 && (
              <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium text-blue-400">
                {pendingDiscoveries} discover{pendingDiscoveries === 1 ? "y" : "ies"}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <ProjectOverview projects={projects} onUpdate={refreshProjects} />
          </div>
        </div>

        {/* Right - Event Feed */}
        <div className={`transition-all duration-150 flex-shrink-0 overflow-hidden ${feedOpen ? "w-80" : "w-10"}`}>
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

      {/* Bottom - Terminal Panel */}
      <TerminalPanel missions={missions} />

      <CreateProjectModal
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onCreated={refreshProjects}
      />
    </div>
  );
}
