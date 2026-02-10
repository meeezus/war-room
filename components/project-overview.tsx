"use client";

import { useState } from "react";
import type { ProjectWithMetrics } from "@/lib/types";
import { ProjectCard } from "./project-card";

const STATUS_ORDER: Record<string, number> = {
  inprogress: 0,
  todo: 1,
  onhold: 2,
  done: 3,
  someday: 4,
};

interface ProjectOverviewProps {
  projects: ProjectWithMetrics[];
}

export function ProjectOverview({ projects }: ProjectOverviewProps) {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...projects].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
  );

  const visible = showAll
    ? sorted
    : sorted.filter((p) => !["done", "someday"].includes(p.status));

  const hiddenCount = sorted.length - sorted.filter((p) => !["done", "someday"].includes(p.status)).length;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {hiddenCount > 0 && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-[rgba(255,255,255,0.4)] transition-colors hover:text-[#E5E5E5]"
          >
            {showAll ? "Hide completed/someday" : `Show all (+${hiddenCount})`}
          </button>
        </div>
      )}
      {visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[rgba(255,255,255,0.4)]">No projects found.</p>
        </div>
      )}
    </div>
  );
}
