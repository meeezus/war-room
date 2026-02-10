"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Step } from "@/lib/types";
import { StealthCard } from "./stealth-card";
import { staggerItem } from "@/lib/motion";

const STATUS_ACCENT: Record<string, string> = {
  queued: "#6b7280",
  running: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444",
  stale: "#eab308",
};

const KIND_COLORS: Record<string, string> = {
  research: "#a855f7",
  code: "#3b82f6",
  review: "#f59e0b",
  test: "#10b981",
  deploy: "#ef4444",
  write: "#06b6d4",
  analyze: "#6366f1",
};

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "Queued";
  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  if (!completedAt) return `Running for ${mins}m ${secs}s`;
  if (mins < 1) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function StepCard({ step }: { step: Step }) {
  const [expanded, setExpanded] = useState(false);
  const statusAccent = STATUS_ACCENT[step.status] ?? "#6b7280";
  const kindColor = step.kind ? KIND_COLORS[step.kind] ?? "#6b7280" : null;

  return (
    <motion.div variants={staggerItem}>
      <StealthCard className="p-3">
        {/* Top row: kind badge + status + model */}
        <div className="flex items-center gap-2 flex-wrap">
          {step.kind && kindColor && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium"
              style={{
                backgroundColor: `${kindColor}20`,
                color: kindColor,
              }}
            >
              {step.kind}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium"
            style={{
              backgroundColor: `${statusAccent}20`,
              color: statusAccent,
            }}
          >
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ backgroundColor: statusAccent }}
            />
            {step.status}
          </span>
          <span className="ml-auto rounded bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.4)]">
            {step.model}
          </span>
        </div>

        {/* Title */}
        <h4 className="mt-2 font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-[#E5E5E5]">
          {step.title}
        </h4>

        {/* Description preview */}
        {step.description && (
          <p className="mt-1 text-xs text-[rgba(255,255,255,0.4)] line-clamp-2">
            {step.description}
          </p>
        )}

        {/* Timing */}
        <div className="mt-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.35)]">
          {formatDuration(step.started_at, step.completed_at)}
        </div>

        {/* Error display for failed steps */}
        {step.status === "failed" && step.error && (
          <div className="mt-2 rounded-sm border border-red-500/20 bg-red-500/[0.08] p-2">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-red-400">
              {step.error}
            </p>
          </div>
        )}

        {/* Output preview for completed steps */}
        {step.status === "completed" && step.output && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] text-emerald-400/70 hover:text-emerald-400 transition-colors"
            >
              <span className="font-[family-name:var(--font-jetbrains-mono)]">
                {expanded ? "Hide output" : "Show output"}
              </span>
              <svg
                className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expanded && (
              <div className="mt-1.5 rounded-sm bg-white/[0.04] p-2">
                <pre className="whitespace-pre-wrap font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[rgba(255,255,255,0.5)]">
                  {step.output}
                </pre>
              </div>
            )}
            {!expanded && (
              <p className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[rgba(255,255,255,0.3)] line-clamp-2">
                {step.output.slice(0, 200)}
                {step.output.length > 200 && "..."}
              </p>
            )}
          </div>
        )}
      </StealthCard>
    </motion.div>
  );
}
