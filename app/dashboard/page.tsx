"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getAgents, getMissions, getEvents, getMissionStats, getPendingDiscoveryCount, getSkillPatchStats, getLastPatrolSummary, getActiveCouncilSessionCount, getAwarenessProposalCount, getObjectivesWithMetrics } from "@/lib/queries";
import type { AgentStatus, Mission, Event, ObjectiveWithMetrics } from "@/lib/types";
import Link from "next/link";
import { StatusRibbon } from "@/components/status-ribbon";
import { AgentSidebar } from "@/components/agent-sidebar";
import { EventFeed } from "@/components/event-feed";
import { StealthCard } from "@/components/stealth-card";
import { ObjectiveOverview } from "@/components/objective-overview";
import { TerminalPanel } from "@/components/terminal/terminal-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Menu, Radio, X } from "lucide-react";

function ConnectPrompt() {
  return (
    <div className="flex h-full items-center justify-center">
      <StealthCard className="max-w-md p-8 text-center">
        <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-foreground">
          Connect Supabase to see live data
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Add these environment variables to your <code className="rounded bg-muted px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs">.env.local</code> file:
        </p>
        <div className="rounded-sm bg-muted/50 p-4 text-left font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground">
          <p>NEXT_PUBLIC_SUPABASE_URL=your-url</p>
          <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key</p>
        </div>
        <p className="mt-4 text-xs text-muted-foreground/75">
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
  const [objectives, setObjectives] = useState<ObjectiveWithMetrics[]>([]);
  const [missionStats, setMissionStats] = useState({ active: 0, total: 0 });
  const [pendingDiscoveries, setPendingDiscoveries] = useState(0);
  const [councilSessions, setCouncilSessions] = useState(0);
  const [awarenessCount, setAwarenessCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [feedOpen, setFeedOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsData, missionsData, eventsData, missionStatsData, discoveryCount, skillStatsData, lastPatrolData, councilSessionCount, awarenessCountData, objectivesData] = await Promise.all([
          getAgents(),
          getMissions(),
          getEvents(),
          getMissionStats(),
          getPendingDiscoveryCount(),
          getSkillPatchStats(),
          getLastPatrolSummary(),
          getActiveCouncilSessionCount(),
          getAwarenessProposalCount(),
          getObjectivesWithMetrics(),
        ]);
        setAgents(agentsData);
        setMissions(missionsData);
        setEvents(eventsData);
        setMissionStats(missionStatsData);
        setPendingDiscoveries(discoveryCount);
        setSkillStats(skillStatsData);
        setLastPatrol(lastPatrolData);
        setCouncilSessions(councilSessionCount);
        setAwarenessCount(awarenessCountData);
        setObjectives(objectivesData);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (!supabase) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background p-2 md:p-4">
        <div className="mb-2 md:mb-4 flex-shrink-0">
          <div className="mb-2 md:mb-3 flex items-baseline gap-3">
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-lg md:text-2xl font-bold tracking-tight text-foreground">
              Dynasty Tenshu
            </h1>
            <span className="hidden md:inline text-xs text-muted-foreground">
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
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background p-2 md:p-4">
      {/* Header */}
      <div className="mb-2 md:mb-4 flex-shrink-0">
        <div className="mb-2 md:mb-3 flex items-center md:items-baseline gap-2 md:gap-3 flex-wrap">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Menu className="h-4 w-4 text-muted-foreground" />
          </button>
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-lg md:text-2xl font-bold tracking-tight text-foreground">
            Dynasty Tenshu
          </h1>
          <span className="hidden md:inline text-xs text-muted-foreground">
            Shogunate Command Center
          </span>
          <span className="ml-auto hidden md:inline font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-muted-foreground/75">
            <Link href="/objectives" className="transition-colors hover:text-foreground/60">
              {objectives.length} objectives
            </Link>
            {" \u00B7 "}
            <Link href="/missions" className="transition-colors hover:text-foreground/60">
              {missions.filter(m => m.status === 'running').length} running
            </Link>
            {" \u00B7 "}
            {missions.filter(m => m.status === 'failed').length + pendingDiscoveries} need attention
          </span>
          {/* Mobile event feed toggle */}
          <button
            onClick={() => setMobileFeedOpen(true)}
            className="md:hidden h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0 ml-auto"
          >
            <Radio className="h-4 w-4 text-muted-foreground" />
          </button>
          <ThemeToggle />
        </div>
        <StatusRibbon
          pendingDiscoveries={pendingDiscoveries}
          lastPatrol={lastPatrol}
          skillStats={skillStats}
          councilSessions={councilSessions}
          awarenessCount={awarenessCount}
        />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-background border-r border-border p-4 overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Daimyo Council
              </span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <AgentSidebar agents={agents} />
          </div>
        </div>
      )}

      {/* Mobile Event Feed Drawer */}
      {mobileFeedOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileFeedOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-80 max-w-[90vw] bg-background border-l border-border p-4 flex flex-col overflow-hidden">
            <div className="mb-3 flex items-center justify-between flex-shrink-0">
              <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Event Feed
              </span>
              <button
                onClick={() => setMobileFeedOpen(false)}
                className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <EventFeed events={events} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left - Agent Sidebar (desktop only) */}
        <div className={`hidden md:block transition-all duration-150 flex-shrink-0 overflow-hidden ${sidebarOpen ? "w-64" : "w-10"}`}>
          {sidebarOpen ? (
            <div className="flex h-full flex-col">
              <div className="mb-2 flex h-6 items-center justify-between">
                <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Daimyo Council
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-muted-foreground font-[family-name:var(--font-space-grotesk)] text-xs hover:text-foreground/60"
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
              className="flex h-full w-10 flex-col items-center pt-2 text-muted-foreground hover:text-foreground/60"
            >
              <span className="font-[family-name:var(--font-space-grotesk)] text-xs [writing-mode:vertical-rl]">DC</span>
              <span className="mt-2 font-[family-name:var(--font-space-grotesk)] text-xs">&raquo;</span>
            </button>
          )}
        </div>

        {/* Center - Objective Overview */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="mb-2 flex h-6 items-center gap-2">
            <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Objectives
            </span>
            {pendingDiscoveries > 0 && (
              <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium text-blue-400">
                {pendingDiscoveries} discover{pendingDiscoveries === 1 ? "y" : "ies"}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <ObjectiveOverview objectives={objectives} />
          </div>
        </div>

        {/* Right - Event Feed (desktop only) */}
        <div className={`hidden md:block transition-all duration-150 flex-shrink-0 overflow-hidden ${feedOpen ? "w-80" : "w-10"}`}>
          {feedOpen ? (
            <div className="flex h-full flex-col">
              <div className="mb-2 flex h-6 items-center justify-between">
                <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Event Feed
                </span>
                <button
                  onClick={() => setFeedOpen(false)}
                  className="text-muted-foreground font-[family-name:var(--font-space-grotesk)] text-xs hover:text-foreground/60"
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
              className="flex h-full w-10 flex-col items-center pt-2 text-muted-foreground hover:text-foreground/60"
            >
              <span className="font-[family-name:var(--font-space-grotesk)] text-xs [writing-mode:vertical-rl]">EF</span>
              <span className="mt-2 font-[family-name:var(--font-space-grotesk)] text-xs">&laquo;</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom - Terminal Panel */}
      <TerminalPanel missions={missions} />
    </div>
  );
}
