"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Task } from "@/lib/types";
import { TASK_STATUS_COLORS } from "@/lib/data";
import { hoverLift, tapScale, SPRING_CONFIG } from "@/lib/motion";
import { StealthCard } from "./stealth-card";

export type TaskWithProject = Task & { projects?: { title: string } | null };

const PRIORITY_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: "bg-red-500/15", text: "text-red-400" },
  2: { bg: "bg-orange-500/15", text: "text-orange-400" },
  3: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  4: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  5: { bg: "bg-blue-500/15", text: "text-blue-400" },
};

export function TaskKanbanCard({ task }: { task: TaskWithProject }) {
  const prefersReducedMotion = useReducedMotion();
  const accent = TASK_STATUS_COLORS[task.status] ?? "#6b7280";
  const priorityStyle = task.priority ? PRIORITY_COLORS[task.priority] : null;
  const isStale = task.status !== 'done' && task.status !== 'someday' &&
    new Date(task.updated_at).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000;

  return (
    <motion.div
      whileTap={prefersReducedMotion ? undefined : tapScale}
      whileHover={prefersReducedMotion ? undefined : hoverLift}
      transition={SPRING_CONFIG}
    >
      <StealthCard className="p-3">
        <h3 className="line-clamp-2 font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-[#E5E5E5]">
          {task.title}
        </h3>

        {task.projects?.title && (
          <p className="mt-1 truncate font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.3)]">
            {task.projects.title}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {task.owner && (
            <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40">
              {task.owner}
            </span>
          )}
          {priorityStyle && task.priority != null && (
            <span
              className={`rounded-full px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium ${priorityStyle.bg} ${priorityStyle.text}`}
            >
              P{task.priority}
            </span>
          )}
          {isStale && (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              stale
            </span>
          )}
        </div>
      </StealthCard>
    </motion.div>
  );
}
