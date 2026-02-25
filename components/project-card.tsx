"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ProjectWithMetrics } from "@/lib/types";
import { PROJECT_STATUS_COLORS } from "@/lib/data";
import { hoverLift, tapScale, SPRING_CONFIG } from "@/lib/motion";
import { StealthCard } from "./stealth-card";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTargetDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function isOverdue(targetDate: string, status: string): boolean {
  return new Date(targetDate) < new Date() && status !== "done";
}

const STATUS_OPTIONS = [
  { value: "queue", label: "Queue" },
  { value: "inprogress", label: "In Progress" },
  { value: "onhold", label: "On Hold" },
  { value: "done", label: "Done" },
] as const;

interface ProjectCardProps {
  project: ProjectWithMetrics;
  onUpdate?: () => void;
  discoveryCount?: number;
}

export function ProjectCard({ project, onUpdate, discoveryCount = 0 }: ProjectCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const accent = PROJECT_STATUS_COLORS[project.status] ?? "#6b7280";
  const progressPct = project.totalTasks > 0 ? (project.taskCounts.done / project.totalTasks) * 100 : 0;

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  async function patchProject(updates: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        onUpdate?.();
      }
    } catch (err) {
      console.error("Failed to update project:", err);
    }
  }

  async function deleteProject() {
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onUpdate?.();
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  }

  async function handleRenameSubmit() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== project.title) {
      await patchProject({ title: trimmed });
    }
    setRenaming(false);
  }

  function handleStatusChange(status: string) {
    patchProject({ status });
    setMenuOpen(false);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setMenuOpen(false);
    if (window.confirm(`Delete "${project.title}"? This cannot be undone.`)) {
      deleteProject();
    }
  }

  const cardContent = (
    <StealthCard className="p-4">
      <div className="flex items-start justify-between gap-2">
        {renaming ? (
          <input
            ref={renameInputRef}
            className="flex-1 rounded-sm border border-border bg-muted px-1.5 py-0.5 font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-foreground outline-none focus:border-ring"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") { setRenaming(false); setRenameValue(project.title); }
            }}
            onBlur={handleRenameSubmit}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          />
        ) : (
          <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-foreground">
            {project.title}
          </h3>
        )}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ backgroundColor: accent }}
            />
            {project.status}
          </span>

          {/* Three-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setMenuOpen(!menuOpen);
              }}
              className="flex size-6 items-center justify-center rounded-sm text-muted-foreground/75 transition-colors hover:bg-accent hover:text-foreground/60"
            >
              <span className="text-sm leading-none">&#xB7;&#xB7;&#xB7;</span>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-7 z-50 min-w-[140px] rounded-sm border border-border bg-[rgba(14,14,14,0.97)] py-1 shadow-xl backdrop-blur-xl"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
              >
                {/* Rename */}
                <button
                  className="flex w-full items-center px-3 py-1.5 text-left text-xs text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setRenameValue(project.title);
                    setRenaming(true);
                    setMenuOpen(false);
                  }}
                >
                  Rename
                </button>

                {/* Status options (inline) */}
                <div className="border-t border-border my-1" />
                <div className="px-2 py-1">
                  <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground/50">Status</span>
                </div>
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted ${
                      project.status === opt.value
                        ? "text-foreground font-medium"
                        : "text-foreground/60"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleStatusChange(opt.value);
                    }}
                  >
                    <span
                      className="inline-block size-1.5 rounded-full"
                      style={{ backgroundColor: PROJECT_STATUS_COLORS[opt.value] }}
                    />
                    {opt.label}
                  </button>
                ))}

                {/* Divider */}
                <div className="my-1 border-t border-border" />

                {/* Delete */}
                <button
                  className="flex w-full items-center px-3 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10"
                  onClick={handleDelete}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {project.goal && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {project.goal}
        </p>
      )}

      {/* Task metrics + target date */}
      <div className="mt-2 flex items-center gap-2">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/75">
          {project.activeTasks} active &middot; {project.totalTasks} total
        </span>
        {project.lastActivity && (
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/60">
            {relativeTime(project.lastActivity)}
          </span>
        )}
        {project.pendingProposals > 0 && (
          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium text-amber-400">
            {project.pendingProposals} pending
          </span>
        )}
        {discoveryCount > 0 && (
          <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium text-blue-400">
            {discoveryCount} discover{discoveryCount === 1 ? "y" : "ies"}
          </span>
        )}
        {project.target_date && (
          <span
            className={`font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium ${
              isOverdue(project.target_date, project.status)
                ? "text-red-400"
                : "text-muted-foreground/75"
            }`}
          >
            {isOverdue(project.target_date, project.status)
              ? "Overdue"
              : `Due: ${formatTargetDate(project.target_date)}`}
          </span>
        )}
      </div>

      {/* Progress mini-bar */}
      {project.totalTasks > 0 && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {project.type && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {project.type}
          </span>
        )}
        {project.owner && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {project.owner}
          </span>
        )}
        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-400">
          P{project.priority}
        </span>
      </div>
    </StealthCard>
  );

  // When renaming or menu is open, don't wrap in Link to prevent navigation
  if (renaming || menuOpen) {
    return (
      <motion.div
        className={menuOpen ? "relative z-50" : ""}
        whileTap={prefersReducedMotion ? undefined : tapScale}
        whileHover={prefersReducedMotion ? undefined : hoverLift}
        transition={SPRING_CONFIG}
      >
        {cardContent}
      </motion.div>
    );
  }

  return (
    <Link href={`/projects/${project.id}`}>
      <motion.div
        whileTap={prefersReducedMotion ? undefined : tapScale}
        whileHover={prefersReducedMotion ? undefined : hoverLift}
        transition={SPRING_CONFIG}
      >
        {cardContent}
      </motion.div>
    </Link>
  );
}
