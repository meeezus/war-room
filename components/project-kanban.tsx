"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { TaskKanbanCard } from "./task-kanban-card";
import { useRealtimeTasks } from "@/lib/realtime";

const KANBAN_COLUMNS = [
  { key: "todo", label: "Todo", status: "todo", accent: "#6b7280" },
  { key: "assigned", label: "Assigned", status: "assigned", accent: "#f59e0b" },
  { key: "in_progress", label: "In Progress", status: "in_progress", accent: "#3b82f6" },
  { key: "review", label: "Review", status: "review", accent: "#8b5cf6" },
  { key: "done", label: "Done", status: "done", accent: "#10b981" },
  { key: "blocked", label: "Blocked", status: "blocked", accent: "#ef4444" },
] as const;

interface ProjectKanbanProps {
  tasks: Task[];
  projectId: string;
}

export function ProjectKanban({ tasks, projectId }: ProjectKanbanProps) {
  const liveTasks = useRealtimeTasks(tasks, projectId);
  const [showAllDone, setShowAllDone] = useState(false);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  return (
    <div className="flex h-full gap-3 overflow-x-auto">
      {KANBAN_COLUMNS.map((col) => {
        const allCards = liveTasks.filter((t) => t.status === col.status);
        // For done column: show last 7 days by default, with expand toggle
        const cards =
          col.status === "done" && !showAllDone
            ? allCards.filter((t) => t.updated_at >= sevenDaysAgo)
            : allCards;
        const hiddenDone =
          col.status === "done" ? allCards.length - cards.length : 0;

        // Skip blocked column entirely when empty
        if (col.status === "blocked" && allCards.length === 0) return null;

        return (
          <div
            key={col.key}
            className={`flex min-w-[160px] flex-1 flex-col ${
              col.status === "blocked" ? "max-w-[200px]" : ""
            }`}
          >
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
              {col.status === "done" && hiddenDone > 0 && (
                <button
                  onClick={() => setShowAllDone(true)}
                  className="mt-1 text-xs text-[rgba(255,255,255,0.4)] hover:text-[#E5E5E5]"
                >
                  Show all (+{hiddenDone})
                </button>
              )}
              {col.status === "done" && showAllDone && allCards.length > 0 && (
                <button
                  onClick={() => setShowAllDone(false)}
                  className="mt-1 text-xs text-[rgba(255,255,255,0.4)] hover:text-[#E5E5E5]"
                >
                  Show recent only
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
