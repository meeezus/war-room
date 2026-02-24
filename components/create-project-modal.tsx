"use client";

import { useState, useEffect } from "react";
import { Dialog } from "radix-ui";
import { createProject } from "@/lib/queries";
import type { Project } from "@/lib/types";

const inputClass =
  "w-full rounded-sm border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/20 transition-colors";

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (p: Project) => void;
}

export function CreateProjectModal({
  open,
  onOpenChange,
  onCreated,
}: CreateProjectModalProps) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setGoal("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const project = await createProject({
      title: title.trim(),
      description: goal.trim() || undefined,
    });
    setSaving(false);
    if (project) {
      onCreated?.(project);
      onOpenChange(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-sm border border-border bg-popover backdrop-blur-xl p-6 shadow-2xl focus:outline-none">
          <Dialog.Title className="font-[family-name:var(--font-space-grotesk)] text-base font-semibold text-foreground mb-4">
            Create Project
          </Dialog.Title>
          <form onSubmit={handleSubmit}>
            <label className="block mb-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
                Title
              </span>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Project title"
                autoFocus
              />
            </label>
            <label className="block mb-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
                Goal
              </span>
              <textarea
                className={`${inputClass} min-h-[80px] resize-y`}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What is this project trying to achieve?"
                rows={3}
              />
            </label>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
