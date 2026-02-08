"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task, TaskStatus } from "@/lib/data";
import { TaskCard } from "./task-card";
import { StealthCard } from "./stealth-card";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: TaskStatus;
  label: string;
  tasks: Task[];
}

export function KanbanColumn({ id, label, tasks }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <StealthCard
      hover={false}
      className={cn(
        "overflow-hidden transition-colors duration-200",
        isOver && "border-emerald-500/30"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
        <h3 className="font-display text-xs font-semibold tracking-wide text-white/60 uppercase">
          {label}
        </h3>
        <span className="inline-flex size-5 items-center justify-center rounded bg-emerald-500/15 font-mono text-[10px] font-medium text-emerald-400">
          {tasks.length}
        </span>
      </div>

      {/* Task list */}
      <div ref={setNodeRef} className="flex min-h-[120px] flex-col gap-2 p-2">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>
    </StealthCard>
  );
}
