"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { TASK_STATUS_COLORS } from "@/lib/data";

export function TaskRow({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false);
  const accent = TASK_STATUS_COLORS[task.status] ?? "#6b7280";

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.02]"
      >
        {/* Status dot */}
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />

        {/* Title */}
        <span className="min-w-0 flex-1 truncate text-sm text-[rgba(255,255,255,0.7)]">
          {task.title}
        </span>

        {/* Priority */}
        {task.priority !== null && task.priority !== undefined && (
          <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.3)]">
            P{task.priority}
          </span>
        )}

        {/* Owner */}
        {task.owner && (
          <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40">
            {task.owner}
          </span>
        )}

        {/* Status badge */}
        <span
          className="shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase"
          style={{ backgroundColor: `${accent}20`, color: accent }}
        >
          {task.status}
        </span>
      </button>

      {/* Expanded notes */}
      {expanded && (task.notes || task.goal) && (
        <div className="border-t border-white/[0.04] bg-white/[0.01] px-4 py-3 pl-9">
          {task.goal && (
            <p className="text-xs text-[rgba(255,255,255,0.5)]">
              <span className="font-medium text-[rgba(255,255,255,0.6)]">Goal: </span>
              {task.goal}
            </p>
          )}
          {task.notes && (
            <p className="mt-1 text-xs text-[rgba(255,255,255,0.35)]">
              {task.notes}
            </p>
          )}
          {task.completed_at && (
            <p className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.25)]">
              Completed: {new Date(task.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
