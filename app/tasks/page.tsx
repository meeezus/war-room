"use client";

import { useState, useEffect, useCallback } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { TaskBoard } from "@/components/task-board";
import { getAllTasks } from "@/lib/queries";
import type { Task } from "@/lib/types";

const KIND_OPTIONS = ["research", "code", "review", "test", "deploy", "write", "analyze"] as const;

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [daimyos, setDaimyos] = useState<string[]>([]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const data = await getAllTasks({
      kind: kindFilter || undefined,
      daimyo: agentFilter || undefined,
      search: search || undefined,
    });
    setTasks(data);
    setLoading(false);
  }, [kindFilter, agentFilter, search]);

  // Populate agent dropdown from initial load
  useEffect(() => {
    getAllTasks().then((data) => {
      const unique = Array.from(
        new Set(data.map((t) => t.daimyo).filter((d): d is string => !!d))
      ).sort();
      setDaimyos(unique);
    });
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex h-12 flex-shrink-0 items-center gap-2 sm:gap-4 border-b border-border/50 pl-14 pr-4 sm:px-5 lg:pl-5">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-[14px] font-semibold tracking-tight">
            Task Board
          </h1>

          <div className="flex flex-1 items-center gap-2">
            {/* Kind filter */}
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="rounded-sm border border-border/50 bg-card px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground outline-none focus:border-border"
            >
              <option value="">All kinds</option>
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>

            {/* Agent filter */}
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="rounded-sm border border-border/50 bg-card px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground outline-none focus:border-border"
            >
              <option value="">All agents</option>
              {daimyos.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Search */}
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 rounded-sm border border-border/50 bg-card px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-border"
            />
          </div>

          {/* Task count */}
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/50">
            {tasks.length} tasks
          </span>
        </div>

        {/* Board */}
        <div className="flex-1 overflow-hidden p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/50">
                Loading...
              </span>
            </div>
          ) : (
            <TaskBoard tasks={tasks} />
          )}
        </div>
      </div>
    </div>
  );
}
