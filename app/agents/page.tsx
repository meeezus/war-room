"use client";

import { useState, useEffect, useCallback } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { AgentGrid } from "@/components/agent-grid";
import { getAgentGrid } from "@/lib/queries";
import { useRealtimeAgents } from "@/lib/realtime";
import type { AgentStatus } from "@/lib/types";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [baseAgents, setBaseAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const agents = useRealtimeAgents(baseAgents);

  const fetchData = useCallback(async () => {
    const data = await getAgentGrid();
    setBaseAgents(data as AgentStatus[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Summary counts
  const online  = agents.filter((a) => a.status === "online").length;
  const busy    = agents.filter((a) => a.status === "busy").length;
  const idle    = agents.filter((a) => a.status === "idle").length;
  const offline = agents.filter((a) => a.status === "offline").length;

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <SidebarNav />

      {/* Main Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="flex h-10 flex-shrink-0 items-center gap-4 border-b border-border/50 px-5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
          <span>Tenshu</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground/60">Agents</span>
          <span className="flex-1" />
          <span className="tabular-nums">{agents.length} total</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-foreground">
                Agent Squad
              </h1>

              {/* Summary dots */}
              {!loading && (
                <div className="flex items-center gap-3">
                  {online > 0 && (
                    <span className="flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-green-500">
                      <span className="size-1.5 rounded-full bg-green-500 shadow-[0_0_4px] shadow-green-500" />
                      {online} online
                    </span>
                  )}
                  {busy > 0 && (
                    <span className="flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-amber-500">
                      <span className="size-1.5 rounded-full bg-amber-500 shadow-[0_0_4px] shadow-amber-500" />
                      {busy} busy
                    </span>
                  )}
                  {idle > 0 && (
                    <span className="flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-blue-400">
                      <span className="size-1.5 rounded-full bg-blue-500/60" />
                      {idle} idle
                    </span>
                  )}
                  {offline > 0 && (
                    <span className="flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/50">
                      <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                      {offline} offline
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Refresh button */}
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 rounded-sm border border-border/50 bg-card px-3 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              <span>⟳</span>
              <span>Refresh</span>
            </button>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground">
                Loading agents...
              </p>
            </div>
          ) : (
            <AgentGrid agents={agents} />
          )}
        </div>
      </div>
    </div>
  );
}
