"use client";

import { useState } from "react";
import type { Proposal } from "@/lib/types";

const DOMAINS = [
  "engineering",
  "product",
  "commerce",
  "influence",
  "operations",
  "coordination",
] as const;

const RISK_LEVELS = ["low", "medium", "high"] as const;

interface CreateProposalDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (proposal: Proposal) => void;
}

export function CreateProposalDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
}: CreateProposalDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState<string>("");
  const [riskLevel, setRiskLevel] = useState<string>("low");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          domain: domain || null,
          projectId,
          riskLevel,
        }),
      });

      if (res.ok) {
        const proposal = await res.json();
        setTitle("");
        setDescription("");
        setDomain("");
        setRiskLevel("low");
        onCreated?.(proposal);
        onOpenChange(false);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create proposal");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-lg font-bold text-zinc-100">
          New Proposal
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block font-[family-name:var(--font-jetbrains-mono)] text-xs text-zinc-400">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block font-[family-name:var(--font-jetbrains-mono)] text-xs text-zinc-400">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details, context, acceptance criteria..."
              rows={3}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Domain + Risk row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block font-[family-name:var(--font-jetbrains-mono)] text-xs text-zinc-400">
                Domain
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">None</option>
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="mb-1 block font-[family-name:var(--font-jetbrains-mono)] text-xs text-zinc-400">
                Risk Level
              </label>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Proposal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
