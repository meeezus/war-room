"use client";

import { useState } from "react";
import type { Board, Task } from "@/lib/types";
import { StealthCard } from "./stealth-card";
import { TaskRow } from "./task-row";

interface BoardSectionProps {
  board: Board;
  tasks: Task[];
}

export function BoardSection({ board, tasks }: BoardSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <StealthCard hover={false} className="overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between border-b border-white/[0.06] px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs text-[rgba(255,255,255,0.3)] transition-transform duration-150"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0)" }}
          >
            ▾
          </span>
          <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-[#E5E5E5]">
            {board.title}
          </h3>
          <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.3)]">
            {board.board_type}
          </span>
        </div>
        <span className="inline-flex size-5 items-center justify-center rounded bg-emerald-500/15 font-mono text-[10px] font-medium text-emerald-400">
          {tasks.length}
        </span>
      </button>

      {!collapsed && (
        <div className="divide-y divide-white/[0.04]">
          {tasks.length > 0 ? (
            tasks.map((task) => <TaskRow key={task.id} task={task} />)
          ) : (
            <p className="px-4 py-3 text-xs text-[rgba(255,255,255,0.3)]">
              No active tasks.
            </p>
          )}
        </div>
      )}
    </StealthCard>
  );
}
