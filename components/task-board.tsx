"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: {
  id: string;
  label: string;
  statuses: Task["status"][];
  color: string;
}[] = [
  {
    id: "queued",
    label: "Queued",
    statuses: ["todo", "assigned", "queued", "someday"],
    color: "text-muted-foreground",
  },
  {
    id: "in_progress",
    label: "In Progress",
    statuses: ["in_progress", "review"],
    color: "text-blue-400",
  },
  {
    id: "done",
    label: "Done",
    statuses: ["done"],
    color: "text-green-400",
  },
  {
    id: "failed",
    label: "Failed",
    statuses: ["failed", "blocked"],
    color: "text-red-400",
  },
];

// ── Kind badge colors ─────────────────────────────────────────────────────────

const KIND_COLORS: Record<NonNullable<Task["kind"]>, string> = {
  research: "bg-purple-500/15 text-purple-400",
  code: "bg-blue-500/15 text-blue-400",
  review: "bg-amber-500/15 text-amber-400",
  test: "bg-green-500/15 text-green-400",
  deploy: "bg-red-500/15 text-red-400",
  write: "bg-cyan-500/15 text-cyan-400",
  analyze: "bg-gray-500/15 text-gray-400",
};

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({ task }: { task: Task }) {
  const kindColor = task.kind ? KIND_COLORS[task.kind] : "bg-muted/30 text-muted-foreground";

  const duration =
    task.started_at && task.completed_at
      ? formatDistanceToNowStrict(new Date(task.started_at), {
          addSuffix: false,
        })
      : task.started_at && !task.completed_at
      ? formatDistanceToNowStrict(new Date(task.started_at), { addSuffix: false }) + " running"
      : null;

  return (
    <div className="rounded-sm border border-border/40 bg-card px-2.5 py-2 transition-colors hover:border-border/70 hover:bg-card/80">
      {/* Title */}
      <div className="mb-1.5 line-clamp-2 text-[11px] leading-snug text-foreground/90">
        {task.title}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {task.kind && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] font-medium uppercase tracking-wide",
              kindColor
            )}
          >
            {task.kind}
          </span>
        )}

        {task.daimyo && (
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/70">
            {task.daimyo}
          </span>
        )}

        {duration && (
          <span className="ml-auto font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-muted-foreground/50">
            {duration}
          </span>
        )}
      </div>

      {/* Mission link */}
      {task.mission_id && (
        <div className="mt-1">
          <Link
            href={`/missions/${task.mission_id}`}
            className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-muted-foreground/40 underline-offset-2 hover:text-muted-foreground/70 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            mission ↗
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function KanbanColumn({
  id,
  label,
  color,
  tasks,
}: {
  id: string;
  label: string;
  color: string;
  tasks: Task[];
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Column header */}
      <div className="mb-2 flex items-center gap-2 border-b border-border/40 pb-2">
        <span
          className={cn(
            "font-[family-name:var(--font-space-grotesk)] text-[11px] font-semibold uppercase tracking-wider",
            color
          )}
        >
          {label}
        </span>
        <span className="rounded bg-muted/40 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-muted-foreground/70">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {tasks.length === 0 && (
          <div className="py-4 text-center font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/30">
            empty
          </div>
        )}
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface TaskBoardProps {
  tasks: Task[];
}

export function TaskBoard({ tasks }: TaskBoardProps) {
  return (
    <div className="flex h-full gap-3">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => col.statuses.includes(t.status));
        return (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            tasks={colTasks}
          />
        );
      })}
    </div>
  );
}
