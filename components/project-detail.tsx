"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { Project, Board, Task, Proposal } from "@/lib/types";
import { PROJECT_STATUS_COLORS } from "@/lib/data";
import { fadeInUp } from "@/lib/motion";
import { StealthCard } from "./stealth-card";
import { ProjectKanban } from "./project-kanban";
import { MissionTableView } from "./mission-table-view";
import { ProposalsSection } from "./proposals-section";
import type { MissionWithSteps } from "./mission-kanban-card";

interface ProjectDetailProps {
  project: Project;
  boards: (Board & { tasks: Task[] })[];
  proposals: Proposal[];
  tasks: Task[];
  missions: MissionWithSteps[];
  onUpdate?: () => void;
}

export function ProjectDetail({ project, boards, proposals, tasks, missions, onUpdate }: ProjectDetailProps) {
  const prefersReducedMotion = useReducedMotion();
  const accent = PROJECT_STATUS_COLORS[project.status] ?? "#6b7280";

  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  useEffect(() => {
    const stored = localStorage.getItem("war-room-view-mode");
    if (stored === "kanban" || stored === "table") {
      setViewMode(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("war-room-view-mode", viewMode);
  }, [viewMode]);

  const totalMissions = missions.length;
  const completedMissions = missions.filter((m) => m.status === "completed").length;
  const progressPct = totalMissions > 0 ? (completedMissions / totalMissions) * 100 : 0;

  return (
    <motion.div
      className="mx-auto max-w-[1600px] space-y-4 p-4"
      {...(prefersReducedMotion ? {} : fadeInUp)}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[rgba(255,255,255,0.4)]">
        <Link
          href="/dashboard"
          className="transition-colors hover:text-[#E5E5E5]"
        >
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-[rgba(255,255,255,0.6)]">
          {project.title}
        </span>
      </nav>

      {/* Project header card */}
      <StealthCard className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-[#E5E5E5]">
              {project.title}
            </h1>
            {project.goal && (
              <p className="mt-1 text-sm text-[rgba(255,255,255,0.4)]">
                {project.goal}
              </p>
            )}
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs font-medium"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: accent }}
            />
            {project.status}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {project.type && (
            <span className="rounded-sm bg-white/[0.06] px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.5)]">
              {project.type}
            </span>
          )}
          {project.owner && (
            <span className="rounded-sm bg-white/[0.06] px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.5)]">
              {project.owner}
            </span>
          )}
          <span className="rounded-sm bg-emerald-500/15 px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-emerald-400">
            P{project.priority}
          </span>
        </div>

        {project.next_action && (
          <div className="mt-3 border-t border-white/[0.06] pt-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[rgba(255,255,255,0.3)]">
              Next Action
            </span>
            <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.5)]">
              {project.next_action}
            </p>
          </div>
        )}
      </StealthCard>

      {/* Progress bar */}
      {totalMissions > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[rgba(255,255,255,0.4)]">
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-space-grotesk)] font-medium">
                Missions
              </span>
              <button
                onClick={() => setViewMode("kanban")}
                className={`rounded px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] transition-colors ${
                  viewMode === "kanban"
                    ? "bg-white/[0.1] text-[rgba(255,255,255,0.6)]"
                    : "text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.5)]"
                }`}
              >
                Board
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`rounded px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] transition-colors ${
                  viewMode === "table"
                    ? "bg-white/[0.1] text-[rgba(255,255,255,0.6)]"
                    : "text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.5)]"
                }`}
              >
                Table
              </button>
            </div>
            <span className="font-[family-name:var(--font-jetbrains-mono)]">
              {completedMissions} / {totalMissions}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Proposals section */}
      <ProposalsSection proposals={proposals} projectId={project.id} onUpdate={onUpdate} />

      {/* Missions view */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: "400px" }}>
        {viewMode === "kanban" ? (
          <ProjectKanban missions={missions} projectId={project.id} />
        ) : (
          <MissionTableView missions={missions} />
        )}
      </div>
    </motion.div>
  );
}
