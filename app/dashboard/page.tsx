"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getAgents, getMissions, getEvents, getStats, getProjects, getDynastyStats, getAllTasks } from "@/lib/queries";
import type { AgentStatus, Mission, Event, DashboardStats, DynastyStats } from "@/lib/types";
import { StatsBar } from "@/components/stats-bar";
import { AgentSidebar } from "@/components/agent-sidebar";
import { EventFeed } from "@/components/event-feed";
import { StealthCard } from "@/components/stealth-card";
import { TaskKanbanCard } from "@/components/task-kanban-card";
import type { TaskWithProject } from "@/components/task-kanban-card";
import { useRealtimeTasks } from "@/lib/realtime";

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

const TASK_COLUMNS: { key: string; label: string; statuses: string[]; accent: string }[] = [
  { key: "active", label: "Active", statuses: ["active"], accent: "#3b82f6" },
  { key: "todo", label: "Todo", statuses: ["todo"], accent: "#6b7280" },
  { key: "blocked", label: "Blocked", statuses: ["blocked"], accent: "#ef4444" },
  { key: "done", label: "Done", statuses: ["done"], accent: "#10b981" },
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

function TasksKanban({ tasks }: { tasks: TaskWithProject[] }) {
  const liveTasks = useRealtimeTasks(tasks as TaskWithProject[]);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  return (
    <div className="flex h-full gap-3">
      {TASK_COLUMNS.map((col) => {
        const cards = liveTasks.filter((t) => {
          if (t.status === "someday") return false;
          if (!col.statuses.includes(t.status)) return false;
          if (t.status === "done" && t.updated_at < sevenDaysAgo) return false;
          return true;
        }) as TaskWithProject[];
        return (
          <div key={col.key} className="flex min-w-0 flex-1 flex-col">
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
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {cards.map((task) => (
                <TaskKanbanCard key={task.id} task={task} />
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
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [dynastyStats, setDynastyStats] = useState<DynastyStats>(defaultDynastyStats);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [feedOpen, setFeedOpen] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [agentsData, missionsData, eventsData, statsData, tasksData, dynastyData] = await Promise.all([
        getAgents(),
        getMissions(),
        getEvents(),
        getStats(),
        getAllTasks(),
        getDynastyStats(),
      ]);
      setAgents(agentsData);
      setMissions(missionsData);
      setEvents(eventsData);
      setStats(statsData);
      setTasks(tasksData as TaskWithProject[]);
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
        <div className={`transition-all duration-150 flex-shrink-0 overflow-hidden ${sidebarOpen ? "w-64" : "w-10"}`}>
          {sidebarOpen ? (
            <div className="flex h-full flex-col overflow-y-auto">
              <button
                onClick={() => setSidebarOpen(false)}
                className="mb-2 self-end text-[rgba(255,255,255,0.4)] font-[family-name:var(--font-space-grotesk)] text-xs hover:text-[rgba(255,255,255,0.6)]"
              >
                &laquo;
              </button>
              <AgentSidebar agents={agents} />
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

        {/* Center - Tasks Kanban */}
        <div className="flex-1 overflow-hidden">
          <TasksKanban tasks={tasks} />
        </div>

        {/* Right - Event Feed */}
        <div className={`transition-all duration-150 flex-shrink-0 overflow-hidden ${feedOpen ? "w-80" : "w-10"}`}>
          {feedOpen ? (
            <div className="flex h-full flex-col">
              <button
                onClick={() => setFeedOpen(false)}
                className="mb-2 self-start text-[rgba(255,255,255,0.4)] font-[family-name:var(--font-space-grotesk)] text-xs hover:text-[rgba(255,255,255,0.6)]"
              >
                &raquo;
              </button>
              <EventFeed events={events} />
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
