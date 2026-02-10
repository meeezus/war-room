"use client";

import { useState } from "react";
import type { ProjectWithMetrics } from "@/lib/types";
import { ProjectCard } from "./project-card";
import { PROJECT_STATUS_COLORS } from "@/lib/data";

const KANBAN_COLUMNS = [
  { key: "someday", label: "Queue", accent: PROJECT_STATUS_COLORS.someday },
  { key: "todo", label: "Todo", accent: PROJECT_STATUS_COLORS.todo },
  { key: "inprogress", label: "In Progress", accent: PROJECT_STATUS_COLORS.inprogress },
  { key: "onhold", label: "On Hold", accent: PROJECT_STATUS_COLORS.onhold },
  { key: "done", label: "Done", accent: PROJECT_STATUS_COLORS.done },
] as const;

interface ProjectOverviewProps {
  projects: ProjectWithMetrics[];
}

export function ProjectOverview({ projects }: ProjectOverviewProps) {
  const [showAllDone, setShowAllDone] = useState(false);

  return (
    <div className="flex h-full gap-3 overflow-x-auto">
      {KANBAN_COLUMNS.map((col) => {
        const cards = projects.filter((p) => p.status === col.key);

        // Hide On Hold when empty
        if (col.key === "onhold" && cards.length === 0) return null;

        // Done column: hidden by default, toggle to show
        if (col.key === "done" && !showAllDone && cards.length === 0) return null;

        return (
          <div
            key={col.key}
            className="flex min-w-[200px] flex-1 flex-col"
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
              {cards.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              {col.key === "done" && showAllDone && cards.length > 0 && (
                <button
                  onClick={() => setShowAllDone(false)}
                  className="mt-1 text-xs text-[rgba(255,255,255,0.4)] hover:text-[#E5E5E5]"
                >
                  Hide done
                </button>
              )}
            </div>
          </div>
        );
      })}
      {/* Toggle for done projects when hidden */}
      {!showAllDone && projects.some((p) => p.status === "done") && (
        <button
          onClick={() => setShowAllDone(true)}
          className="self-start whitespace-nowrap px-2 text-xs text-[rgba(255,255,255,0.4)] hover:text-[#E5E5E5]"
        >
          Show done ({projects.filter((p) => p.status === "done").length})
        </button>
      )}
    </div>
  );
}
