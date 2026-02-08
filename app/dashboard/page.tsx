"use client";

import { StatsBar } from "@/components/stats-bar";
import { AgentSidebar } from "@/components/agent-sidebar";
import { KanbanBoard } from "@/components/kanban-board";
import { EventFeed } from "@/components/event-feed";

export default function DashboardPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background p-4">
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <div className="mb-3 flex items-baseline gap-3">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold tracking-tight text-[#E5E5E5]">
            War Room
          </h1>
          <span className="text-xs text-[rgba(255,255,255,0.4)]">
            Shogunate Command Center
          </span>
        </div>
        <StatsBar />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left - Agent Sidebar */}
        <div className="w-64 flex-shrink-0 overflow-y-auto">
          <AgentSidebar />
        </div>

        {/* Center - Kanban Board */}
        <div className="flex-1 overflow-auto">
          <KanbanBoard />
        </div>

        {/* Right - Event Feed */}
        <div className="w-80 flex-shrink-0">
          <EventFeed />
        </div>
      </div>
    </div>
  );
}
