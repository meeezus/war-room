"use client";

import { useState, useEffect } from "react";
import type { Mission } from "@/lib/types";
import { MissionKanbanCard, type MissionWithSteps } from "./mission-kanban-card";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

const REALTIME_ENABLED = process.env.NEXT_PUBLIC_ENABLE_REALTIME !== "false";

const KANBAN_COLUMNS = [
  { key: "queued", label: "Queued", status: "queued", accent: "#6b7280" },
  { key: "running", label: "Running", status: "running", accent: "#3b82f6" },
  { key: "completed", label: "Completed", status: "completed", accent: "#10b981" },
  { key: "failed", label: "Failed", status: "failed", accent: "#ef4444" },
] as const;

interface ProjectKanbanProps {
  missions: MissionWithSteps[];
  projectId: string;
}

export function ProjectKanban({ missions: initialMissions, projectId }: ProjectKanbanProps) {
  const [missions, setMissions] = useState(initialMissions);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  useEffect(() => {
    setMissions(initialMissions);
  }, [initialMissions]);

  // Realtime subscription
  useEffect(() => {
    if (!REALTIME_ENABLED || !supabase) return;

    const client = supabase;
    const channel: RealtimeChannel = client
      .channel(`missions-kanban-${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "missions" },
        (payload) => {
          const newMission = payload.new as Mission;
          setMissions((prev) => [
            ...prev,
            { ...newMission, stepCounts: { total: 0, completed: 0 }, description: null },
          ]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "missions" },
        (payload) => {
          const updated = payload.new as Mission;
          setMissions((prev) =>
            prev.map((m) =>
              m.id === updated.id ? { ...updated, stepCounts: m.stepCounts, description: m.description } : m,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [projectId]);

  return (
    <div className="flex h-full gap-3 overflow-x-auto">
      {KANBAN_COLUMNS.map((col) => {
        const allCards = missions.filter((m) => m.status === col.status);
        // For completed column: show last 7 days by default
        const cards =
          col.status === "completed" && !showAllCompleted
            ? allCards.filter((m) => m.created_at >= sevenDaysAgo)
            : allCards;
        const hiddenCompleted =
          col.status === "completed" ? allCards.length - cards.length : 0;

        // Skip failed column when empty
        if (col.status === "failed" && allCards.length === 0) return null;

        return (
          <div
            key={col.key}
            className={`flex min-w-[180px] flex-1 flex-col ${
              col.status === "failed" ? "max-w-[220px]" : ""
            }`}
          >
            <div className="mb-2 flex items-center gap-2 px-1">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: col.accent }}
              />
              <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.5)]">
                {col.label}
              </span>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tabular-nums text-[rgba(255,255,255,0.3)]">
                {cards.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {cards.map((mission) => (
                <MissionKanbanCard key={mission.id} mission={mission} />
              ))}
              {col.status === "completed" && hiddenCompleted > 0 && (
                <button
                  onClick={() => setShowAllCompleted(true)}
                  className="mt-1 text-xs text-[rgba(255,255,255,0.4)] hover:text-[#E5E5E5]"
                >
                  Show all (+{hiddenCompleted})
                </button>
              )}
              {col.status === "completed" && showAllCompleted && allCards.length > 0 && (
                <button
                  onClick={() => setShowAllCompleted(false)}
                  className="mt-1 text-xs text-[rgba(255,255,255,0.4)] hover:text-[#E5E5E5]"
                >
                  Show recent only
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
