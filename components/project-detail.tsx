"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import type { Project, Board, Task, Proposal } from "@/lib/types";
import { PROJECT_STATUS_COLORS } from "@/lib/data";
import { fadeInUp } from "@/lib/motion";
import { StealthCard } from "./stealth-card";
import { Breadcrumb } from "./breadcrumb";
import { ProjectKanban } from "./project-kanban";
import { MissionTableView } from "./mission-table-view";
import { ProposalsSection } from "./proposals-section";
import { CreateMissionModal } from "./create-mission-modal";
import type { MissionWithSteps } from "./mission-kanban-card";
import { TerminalPanel } from "./terminal/terminal-panel";

const STATUS_OPTIONS = [
  { value: "queue", label: "Queue" },
  { value: "todo", label: "Todo" },
  { value: "inprogress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
  { value: "onhold", label: "On Hold" },
  { value: "archived", label: "Archived" },
] as const;

const inputClasses =
  "border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/20 transition-colors";

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

  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [createMissionOpen, setCreateMissionOpen] = useState(false);

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editStatus, setEditStatus] = useState<string>(project.status);
  const [editGoal, setEditGoal] = useState(project.goal ?? "");

  // Optimistic display values — fall back to project prop when not overridden
  const [optimistic, setOptimistic] = useState<{
    title?: string;
    status?: string;
    goal?: string | null;
  } | null>(null);

  const displayTitle = optimistic?.title ?? project.title;
  const displayStatus = optimistic?.status ?? project.status;
  const displayGoal = optimistic?.goal !== undefined ? optimistic.goal : project.goal;

  const accent = PROJECT_STATUS_COLORS[displayStatus] ?? "#6b7280";

  const startEditing = useCallback(() => {
    setEditTitle(optimistic?.title ?? project.title);
    setEditStatus(optimistic?.status ?? project.status);
    setEditGoal((optimistic?.goal !== undefined ? optimistic.goal : project.goal) ?? "");
    setIsEditing(true);
  }, [project, optimistic]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const saveEdits = useCallback(async () => {
    const changes: Record<string, unknown> = {};
    const currentTitle = optimistic?.title ?? project.title;
    const currentStatus = optimistic?.status ?? project.status;
    const currentGoal = optimistic?.goal !== undefined ? optimistic.goal : project.goal;

    if (editTitle.trim() && editTitle.trim() !== currentTitle) {
      changes.title = editTitle.trim();
    }
    if (editStatus !== currentStatus) {
      changes.status = editStatus;
    }
    const goalValue = editGoal.trim() || null;
    if (goalValue !== (currentGoal ?? null)) {
      changes.goal = goalValue;
    }

    if (Object.keys(changes).length === 0) {
      setIsEditing(false);
      return;
    }

    // Optimistic update
    setOptimistic((prev) => ({
      ...prev,
      ...(changes.title !== undefined ? { title: changes.title as string } : {}),
      ...(changes.status !== undefined ? { status: changes.status as string } : {}),
      ...(changes.goal !== undefined ? { goal: changes.goal as string | null } : {}),
    }));
    setIsEditing(false);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      // Success — keep optimistic values, trigger parent refresh
      onUpdate?.();
    } catch {
      // Revert optimistic update
      setOptimistic(null);
    } finally {
      setIsSaving(false);
    }
  }, [editTitle, editStatus, editGoal, project, optimistic, onUpdate]);

  // Clear optimistic overrides when project prop updates (parent refreshed)
  useEffect(() => {
    setOptimistic(null);
  }, [project.title, project.status, project.goal]);

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
    <div className="flex h-screen flex-col overflow-hidden bg-background">
    <motion.div
      className="mx-auto w-full max-w-[1600px] flex-1 overflow-y-auto space-y-4 p-4"
      {...(prefersReducedMotion ? {} : fadeInUp)}
    >
      {/* Breadcrumb */}
      <Breadcrumb segments={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Projects", href: "/dashboard" },
        { label: displayTitle },
      ]} />

      {/* Project header card */}
      <StealthCard className="p-5">
        {isEditing ? (
          /* ---- EDIT MODE ---- */
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={`${inputClasses} w-full rounded-sm font-[family-name:var(--font-space-grotesk)] text-xl font-bold`}
                placeholder="Project title"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/75">
                Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className={`${inputClasses} rounded-sm font-[family-name:var(--font-jetbrains-mono)] text-xs`}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/75">
                Goal / Description
              </label>
              <textarea
                value={editGoal}
                onChange={(e) => setEditGoal(e.target.value)}
                rows={3}
                className={`${inputClasses} w-full resize-y rounded-sm`}
                placeholder="Project goal or description"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={saveEdits}
                disabled={isSaving || !editTitle.trim()}
                className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Check className="size-3" />
                )}
                Save
              </button>
              <button
                onClick={cancelEditing}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <X className="size-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ---- DISPLAY MODE ---- */
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <div>
                  <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-foreground">
                    {displayTitle}
                  </h1>
                  {displayGoal && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {displayGoal}
                    </p>
                  )}
                </div>
                <button
                  onClick={startEditing}
                  className="mt-1 shrink-0 rounded-sm p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
                  title="Edit project"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs font-medium"
                style={{ backgroundColor: `${accent}20`, color: accent }}
              >
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                {displayStatus}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {project.type && (
                <span className="rounded-sm bg-muted px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground">
                  {project.type}
                </span>
              )}
              {project.owner && (
                <span className="rounded-sm bg-muted px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground">
                  {project.owner}
                </span>
              )}
              <span className="rounded-sm bg-emerald-500/15 px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-emerald-400">
                P{project.priority}
              </span>
              <button
                onClick={() => setCreateMissionOpen(true)}
                className="ml-auto px-2.5 py-1 rounded-sm border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
              >
                + Mission
              </button>
            </div>

            {project.next_action && (
              <div className="mt-3 border-t border-border pt-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/75">
                  Next Action
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {project.next_action}
                </p>
              </div>
            )}
          </>
        )}
      </StealthCard>

      {/* Progress bar */}
      {totalMissions > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-space-grotesk)] font-medium">
                Missions
              </span>
              <button
                onClick={() => setViewMode("kanban")}
                className={`rounded px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] transition-colors ${
                  viewMode === "kanban"
                    ? "bg-accent text-foreground/60"
                    : "text-muted-foreground/75 hover:text-muted-foreground"
                }`}
              >
                Board
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`rounded px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] transition-colors ${
                  viewMode === "table"
                    ? "bg-accent text-foreground/60"
                    : "text-muted-foreground/75 hover:text-muted-foreground"
                }`}
              >
                Table
              </button>
            </div>
            <span className="font-[family-name:var(--font-jetbrains-mono)]">
              {completedMissions} / {totalMissions}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
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

      <CreateMissionModal
        open={createMissionOpen}
        onOpenChange={setCreateMissionOpen}
        projectId={project.id}
        onCreated={() => onUpdate?.()}
      />
    </motion.div>
    <TerminalPanel />
    </div>
  );
}
