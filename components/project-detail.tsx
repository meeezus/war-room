"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { Project, Board, Task } from "@/lib/types";
import { PROJECT_STATUS_COLORS } from "@/lib/data";
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/motion";
import { StealthCard } from "./stealth-card";
import { BoardSection } from "./board-section";

interface ProjectDetailProps {
  project: Project;
  boards: (Board & { tasks: Task[] })[];
}

export function ProjectDetail({ project, boards }: ProjectDetailProps) {
  const prefersReducedMotion = useReducedMotion();
  const accent = PROJECT_STATUS_COLORS[project.status] ?? "#6b7280";
  const [showHistory, setShowHistory] = useState(false);

  const activeBoards = boards.map((board) => ({
    ...board,
    tasks: showHistory
      ? board.tasks
      : board.tasks.filter((t) => t.status !== "done"),
  }));

  const totalTasks = boards.reduce((sum, b) => sum + b.tasks.length, 0);
  const doneTasks = boards.reduce(
    (sum, b) => sum + b.tasks.filter((t) => t.status === "done").length,
    0,
  );
  const progressPct = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  return (
    <motion.div
      className="mx-auto max-w-4xl space-y-4 p-4"
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
      {totalTasks > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[rgba(255,255,255,0.4)]">
            <span className="font-[family-name:var(--font-space-grotesk)] font-medium">
              Tasks
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)]">
              {doneTasks} / {totalTasks}
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

      {/* Show History toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-xs text-[rgba(255,255,255,0.4)] transition-colors hover:text-[#E5E5E5]"
        >
          {showHistory ? "Hide Completed" : "Show History"}
        </button>
      </div>

      {/* Board sections */}
      {activeBoards.length > 0 ? (
        <motion.div
          className="space-y-4"
          variants={prefersReducedMotion ? undefined : staggerContainer}
          initial="hidden"
          animate="show"
        >
          {activeBoards.map((board) => (
            <motion.div
              key={board.id}
              variants={prefersReducedMotion ? undefined : staggerItem}
            >
              <BoardSection board={board} tasks={board.tasks} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <StealthCard className="p-6 text-center">
          <p className="text-sm text-[rgba(255,255,255,0.4)]">
            No boards found for this project.
          </p>
        </StealthCard>
      )}
    </motion.div>
  );
}
