"use client";

import { useState } from "react";
import {
  DndContext,
  closestCorners,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useReducedMotion } from "motion/react";
import { INITIAL_TASKS, COLUMNS, type Task, type TaskStatus } from "@/lib/data";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";

export function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  // Group tasks by column status
  const tasksByColumn = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.id),
  }));

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = String(active.id);
    const overId = String(over.id);

    // Determine target column: if over a column droppable, use that; if over a task, use that task's status
    const isOverColumn = COLUMNS.some((col) => col.id === overId);
    let targetStatus: TaskStatus | undefined;

    if (isOverColumn) {
      targetStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;
      }
    }

    if (!targetStatus) return;

    const taskToMove = tasks.find((t) => t.id === activeTaskId);
    if (!taskToMove || taskToMove.status === targetStatus) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeTaskId ? { ...t, status: targetStatus } : t
      )
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over) {
      const activeTaskId = String(active.id);
      const overId = String(over.id);

      const isOverColumn = COLUMNS.some((col) => col.id === overId);
      let targetStatus: TaskStatus | undefined;

      if (isOverColumn) {
        targetStatus = overId as TaskStatus;
      } else {
        const overTask = tasks.find((t) => t.id === overId);
        if (overTask) {
          targetStatus = overTask.status;
        }
      }

      if (targetStatus) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === activeTaskId ? { ...t, status: targetStatus } : t
          )
        );
      }
    }

    setActiveId(null);
  }

  return (
    <div className="flex-1 overflow-auto">
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-4">
          {tasksByColumn.map((col) => (
            <SortableContext
              key={col.id}
              items={col.tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn id={col.id} label={col.label} tasks={col.tasks} />
            </SortableContext>
          ))}
        </div>

        <DragOverlay dropAnimation={prefersReducedMotion ? null : undefined}>
          {activeTask ? (
            <TaskCard task={activeTask} isDragOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
