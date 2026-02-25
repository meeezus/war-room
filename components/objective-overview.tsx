"use client";

import { useState } from "react";
import type { ObjectiveWithMetrics } from "@/lib/types";
import { ObjectiveCard } from "./objective-card";

const OBJECTIVE_STATUS_COLORS: Record<string, string> = {
  active: "#10b981",
  paused: "#f59e0b",
  completed: "#10b981",
  failed: "#ef4444",
  capped: "#f59e0b",
};

const KANBAN_COLUMNS = [
  { key: "active", label: "Active", accent: OBJECTIVE_STATUS_COLORS.active },
  { key: "paused", label: "Paused", accent: OBJECTIVE_STATUS_COLORS.paused },
  { key: "completed", label: "Completed", accent: OBJECTIVE_STATUS_COLORS.completed },
  { key: "failed", label: "Failed", accent: OBJECTIVE_STATUS_COLORS.failed },
] as const;

interface ObjectiveOverviewProps {
  objectives: ObjectiveWithMetrics[];
  onUpdate?: () => void;
}

export function ObjectiveOverview({ objectives, onUpdate }: ObjectiveOverviewProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  return (
    <div className="flex h-full gap-3 overflow-x-auto">
      {KANBAN_COLUMNS.map((col) => {
        const cards = objectives.filter((o) => o.status === col.key);

        // Hide empty columns (except completed which has a toggle)
        if (col.key === "completed") {
          if (!showCompleted && cards.length === 0) return null;
          if (!showCompleted && cards.length > 0) return null;
        } else {
          if (cards.length === 0) return null;
        }

        return (
          <div
            key={col.key}
            className="flex min-w-[200px] flex-1 flex-col"
          >
            <div className="mb-2 flex items-center gap-2 px-1">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: col.accent }}
              />
              <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.label}
              </span>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tabular-nums text-muted-foreground/75">
                {cards.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {cards.map((objective) => (
                <ObjectiveCard key={objective.id} objective={objective} />
              ))}
              {col.key === "completed" && showCompleted && cards.length > 0 && (
                <button
                  onClick={() => setShowCompleted(false)}
                  className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Hide completed
                </button>
              )}
            </div>
          </div>
        );
      })}
      {/* Toggle for completed objectives when hidden */}
      {!showCompleted && objectives.some((o) => o.status === "completed") && (
        <button
          onClick={() => setShowCompleted(true)}
          className="self-start whitespace-nowrap px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Show completed ({objectives.filter((o) => o.status === "completed").length})
        </button>
      )}
    </div>
  );
}
