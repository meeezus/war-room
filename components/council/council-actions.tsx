"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { createProject, createMission, getProjects } from "@/lib/queries";
import type { CouncilSession, Mission, Project } from "@/lib/types";

interface CouncilActionsProps {
  session: CouncilSession;
}

// ---------------------------------------------------------------------------
// Shared modal shell matching dark glass theme
// ---------------------------------------------------------------------------

function ModalShell({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white/[0.08] bg-[rgba(10,10,10,0.95)] backdrop-blur-xl p-6 shadow-2xl focus:outline-none">
          <Dialog.Title className="font-[family-name:var(--font-space-grotesk)] text-base font-semibold text-[#E5E5E5] mb-4">
            {title}
          </Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Input field matching theme
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)] mb-1 block">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-sm border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-[#E5E5E5] placeholder:text-[rgba(255,255,255,0.25)] focus:border-white/[0.2] focus:outline-none focus:ring-1 focus:ring-white/[0.1] transition-colors";

// ---------------------------------------------------------------------------
// Create Project Modal
// ---------------------------------------------------------------------------

function CreateProjectModal({
  open,
  onOpenChange,
  defaultTitle,
  defaultGoal,
  councilSessionId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTitle: string;
  defaultGoal: string;
  councilSessionId?: string;
  onCreated?: (p: Project) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [goal, setGoal] = useState(defaultGoal);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setGoal(defaultGoal);
    }
  }, [open, defaultTitle, defaultGoal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const project = await createProject({
      title: title.trim(),
      description: goal.trim() || undefined,
      councilSessionId,
    });
    setSaving(false);
    if (project) {
      onCreated?.(project);
      onOpenChange(false);
    }
  }

  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title="Create Project">
      <form onSubmit={handleSubmit}>
        <Field label="Title">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            autoFocus
          />
        </Field>
        <Field label="Goal">
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What is this project trying to achieve?"
            rows={3}
          />
        </Field>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-xs text-[rgba(255,255,255,0.5)] hover:text-[#E5E5E5] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="px-4 py-1.5 rounded-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
          >
            {saving ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Create Mission Modal
// ---------------------------------------------------------------------------

function CreateMissionModal({
  open,
  onOpenChange,
  defaultTitle,
  preselectedProjectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTitle: string;
  preselectedProjectId?: string;
  onCreated?: (m: Mission) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [projectId, setProjectId] = useState(preselectedProjectId ?? "");
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setLoadingProjects(true);
      getProjects().then((ps) => {
        setProjects(ps);
        // Auto-select if we have a preselected or only one project
        if (preselectedProjectId) {
          setProjectId(preselectedProjectId);
        } else if (ps.length === 1) {
          setProjectId(ps[0].id);
        } else {
          setProjectId("");
        }
        setLoadingProjects(false);
      });
    }
  }, [open, defaultTitle, preselectedProjectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    setSaving(true);
    const mission = await createMission({
      title: title.trim(),
      project_id: projectId,
    });
    setSaving(false);
    if (mission) {
      onCreated?.(mission);
      onOpenChange(false);
    }
  }

  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title="Create Mission">
      <form onSubmit={handleSubmit}>
        <Field label="Title">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mission title"
            autoFocus
          />
        </Field>
        <Field label="Project">
          {loadingProjects ? (
            <div className="text-xs text-[rgba(255,255,255,0.3)] py-2">
              Loading projects...
            </div>
          ) : (
            <select
              className={inputClass}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Select a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-xs text-[rgba(255,255,255,0.5)] hover:text-[#E5E5E5] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim() || !projectId}
            className="px-4 py-1.5 rounded-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-40"
          >
            {saving ? "Creating..." : "Create Mission"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Main action bar
// ---------------------------------------------------------------------------

export function CouncilActions({ session }: CouncilActionsProps) {
  const router = useRouter();
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [missionModalOpen, setMissionModalOpen] = useState(false);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);

  const defaultProjectTitle = session.topic;
  const defaultGoal = session.recommendation ?? "";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mt-8 pt-6 border-t border-white/[0.06]">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[rgba(255,255,255,0.3)] mr-1">
          Actions
        </span>

        <button
          onClick={() => setProjectModalOpen(true)}
          className="px-3 py-1.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
        >
          + Create Project
        </button>

        <button
          onClick={() => setMissionModalOpen(true)}
          className="px-3 py-1.5 rounded-sm border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
        >
          + Create Mission
        </button>

        <button
          onClick={async () => {
            const res = await fetch(`/api/council/${session.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "archived" }),
            });
            if (res.ok) router.push("/council");
          }}
          className="px-3 py-1.5 rounded-sm border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
        >
          Reject
        </button>
      </div>

      <CreateProjectModal
        open={projectModalOpen}
        onOpenChange={setProjectModalOpen}
        defaultTitle={defaultProjectTitle}
        defaultGoal={defaultGoal}
        councilSessionId={session.id}
        onCreated={(p) => {
          setCreatedProject(p);
          router.push(`/projects/${p.id}`);
        }}
      />

      <CreateMissionModal
        open={missionModalOpen}
        onOpenChange={setMissionModalOpen}
        defaultTitle={session.topic}
        preselectedProjectId={createdProject?.id}
        onCreated={(m) => {
          router.push(`/missions/${m.id}`);
        }}
      />
    </>
  );
}
