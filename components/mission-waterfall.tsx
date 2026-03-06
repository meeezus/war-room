"use client";

import { useState, useMemo } from "react";
import type { Task } from "@/lib/types";

// ── Color maps ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  queued: "#6b7280",
  in_progress: "#3b82f6",
  done: "#10b981",
  failed: "#ef4444",
  blocked: "#eab308",
};

const KIND_COLOR: Record<string, string> = {
  research: "#a855f7",
  code: "#3b82f6",
  review: "#f59e0b",
  test: "#10b981",
  deploy: "#ef4444",
  write: "#06b6d4",
  analyze: "#6366f1",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function durationLabel(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function timeAxisLabels(totalMs: number): string[] {
  if (totalMs <= 0) return ["0s"];
  const steps = 5;
  const interval = totalMs / steps;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const ms = interval * i;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const s = ms / 1000;
    if (s < 60) return `${Math.round(s)}s`;
    return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  });
}

// ── Waterfall component ─────────────────────────────────────────────────────

interface WaterfallProps {
  tasks: Task[];
  missionStartedAt: string | null;
  missionCompletedAt: string | null;
}

interface ComputedBar {
  task: Task;
  startPct: number;
  widthPct: number;
  durationMs: number;
  isRunning: boolean;
}

export function MissionWaterfall({
  tasks,
  missionStartedAt,
  missionCompletedAt,
}: WaterfallProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { bars, labels } = useMemo(() => {
    const tasksWithTiming = tasks.filter((t) => t.started_at);
    if (tasksWithTiming.length === 0) {
      return { bars: [] as ComputedBar[], labels: ["0s"] };
    }

    const originMs = missionStartedAt
      ? new Date(missionStartedAt).getTime()
      : Math.min(...tasksWithTiming.map((t) => new Date(t.started_at!).getTime()));

    const now = Date.now();
    const endMs = missionCompletedAt
      ? new Date(missionCompletedAt).getTime()
      : Math.max(
          now,
          ...tasksWithTiming.map((t) =>
            t.completed_at ? new Date(t.completed_at).getTime() : now
          )
        );

    const totalMs = Math.max(endMs - originMs, 1);

    const computed: ComputedBar[] = tasks.map((t) => {
      if (!t.started_at) {
        return { task: t, startPct: 0, widthPct: 0, durationMs: 0, isRunning: false };
      }
      const s = new Date(t.started_at).getTime() - originMs;
      const e = t.completed_at ? new Date(t.completed_at).getTime() - originMs : now - originMs;
      const dur = e - s;
      return {
        task: t,
        startPct: (s / totalMs) * 100,
        widthPct: Math.max((dur / totalMs) * 100, 0.5), // min 0.5% visibility
        durationMs: dur,
        isRunning: !t.completed_at && t.status === "in_progress",
      };
    });

    return { bars: computed, labels: timeAxisLabels(totalMs) };
  }, [tasks, missionStartedAt, missionCompletedAt]);

  if (tasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-[var(--card)]/80 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Execution Waterfall
        </span>
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/50">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Time axis */}
      <div className="relative h-5 border-b border-border/30 mx-4">
        <div className="absolute inset-0 flex justify-between items-end pb-0.5" style={{ left: "140px", right: "0" }}>
          {labels.map((label, i) => (
            <span
              key={i}
              className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-muted-foreground/40 tabular-nums"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Bars */}
      <div className="divide-y divide-border/20">
        {bars.map((bar) => {
          const isExpanded = expandedId === bar.task.id;
          const statusColor = STATUS_COLOR[bar.task.status] ?? "#6b7280";
          const kindColor = bar.task.kind ? KIND_COLOR[bar.task.kind] ?? null : null;
          const hasContent = bar.task.output || bar.task.error;
          const isQueued = !bar.task.started_at;

          return (
            <div key={bar.task.id}>
              {/* Bar row */}
              <div
                className={`flex items-center gap-0 px-4 py-1.5 transition-colors ${
                  hasContent ? "cursor-pointer hover:bg-muted/30" : ""
                } ${isExpanded ? "bg-muted/20" : ""}`}
                onClick={() => hasContent && setExpandedId(isExpanded ? null : bar.task.id)}
              >
                {/* Label column */}
                <div className="w-[140px] flex-shrink-0 flex items-center gap-1.5 pr-2 min-w-0">
                  {kindColor && (
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: kindColor }}
                    />
                  )}
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[11px] text-foreground/80 truncate">
                    {bar.task.title}
                  </span>
                </div>

                {/* Bar area */}
                <div className="flex-1 relative h-6 min-w-0">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex justify-between pointer-events-none">
                    {labels.map((_, i) => (
                      <div key={i} className="w-px h-full bg-border/10" />
                    ))}
                  </div>

                  {isQueued ? (
                    /* Queued: dashed outline */
                    <div
                      className="absolute top-1 h-4 rounded-sm border border-dashed flex items-center justify-center"
                      style={{
                        left: "0%",
                        width: "100%",
                        borderColor: `${statusColor}40`,
                      }}
                    >
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-muted-foreground/40">
                        queued
                      </span>
                    </div>
                  ) : (
                    /* Active bar */
                    <div
                      className={`absolute top-1 h-4 rounded-sm transition-all duration-300 ${
                        bar.isRunning ? "animate-pulse" : ""
                      }`}
                      style={{
                        left: `${bar.startPct}%`,
                        width: `${bar.widthPct}%`,
                        backgroundColor: `${statusColor}30`,
                        borderLeft: `2px solid ${statusColor}`,
                        boxShadow: bar.isRunning
                          ? `0 0 12px ${statusColor}40, inset 0 0 8px ${statusColor}15`
                          : bar.task.status === "failed"
                            ? `0 0 8px ${statusColor}30`
                            : "none",
                      }}
                    >
                      {/* Inner glow bar */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-sm"
                        style={{
                          width: bar.isRunning ? "60%" : "100%",
                          background: `linear-gradient(90deg, ${statusColor}50 0%, ${statusColor}10 100%)`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Meta column */}
                <div className="w-[100px] flex-shrink-0 flex items-center justify-end gap-2 pl-2">
                  {bar.task.model && (
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-muted-foreground/40 truncate max-w-[50px]">
                      {bar.task.model}
                    </span>
                  )}
                  <span
                    className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tabular-nums min-w-[40px] text-right"
                    style={{ color: statusColor }}
                  >
                    {isQueued ? "—" : durationLabel(bar.durationMs)}
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-3 pt-1 ml-[140px]">
                  {bar.task.error && (
                    <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] p-3 mb-2">
                      <span className="font-[family-name:var(--font-space-grotesk)] text-[10px] uppercase tracking-wider text-red-400/60 block mb-1">
                        Error
                      </span>
                      <pre className="whitespace-pre-wrap font-[family-name:var(--font-jetbrains-mono)] text-xs text-red-400/90 leading-relaxed">
                        {bar.task.error}
                      </pre>
                    </div>
                  )}
                  {bar.task.output && (
                    <div className="rounded-md bg-muted/30 p-3">
                      <span className="font-[family-name:var(--font-space-grotesk)] text-[10px] uppercase tracking-wider text-muted-foreground/40 block mb-1">
                        Output
                      </span>
                      <pre className="whitespace-pre-wrap font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/80 leading-relaxed max-h-[200px] overflow-y-auto">
                        {bar.task.output}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
