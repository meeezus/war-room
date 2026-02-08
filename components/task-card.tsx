"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { Task, PRIORITY_COLORS, getDaimyoById } from "@/lib/data";
import { tapScale, hoverLift, SPRING_CONFIG } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  isDragOverlay?: boolean;
}

export function TaskCard({ task, isDragOverlay = false }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: isDragOverlay,
  });

  const style = isDragOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const priorityColor = PRIORITY_COLORS[task.priority];
  const daimyo = task.assignee ? getDaimyoById(task.assignee) : undefined;

  return (
    <motion.div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      whileTap={isDragOverlay ? undefined : tapScale}
      whileHover={isDragOverlay ? undefined : hoverLift}
      transition={SPRING_CONFIG}
      className={cn(
        "cursor-grab rounded-sm border border-white/[0.06] bg-[#0F0F0F] p-3",
        isDragOverlay &&
          "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]",
        isDragging && !isDragOverlay && "opacity-40"
      )}
      {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
    >
      {/* Title and assignee */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-white/90">{task.title}</span>
        {daimyo && (
          <span className="shrink-0 text-sm" title={daimyo.name}>
            {daimyo.emoji}
          </span>
        )}
      </div>

      {/* Priority badge and tags */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium"
          style={{
            backgroundColor: `${priorityColor}20`,
            color: priorityColor,
          }}
        >
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ backgroundColor: priorityColor }}
          />
          {task.priority}
        </span>
        {task.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40"
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
