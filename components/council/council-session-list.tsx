"use client";

import { useState } from "react";
import { CouncilSessionCard } from "./council-session-card";
import type { CouncilSession } from "@/lib/types";

type FilterTab = "all" | "active" | "resolved";

interface CouncilSessionListProps {
  sessions: CouncilSession[];
}

export function CouncilSessionList({ sessions }: CouncilSessionListProps) {
  const [filter, setFilter] = useState<FilterTab>("active");

  const activeCount = sessions.filter((s) => s.status === "active").length;
  const resolvedCount = sessions.filter((s) => s.status === "resolved").length;

  const filtered =
    filter === "all"
      ? sessions
      : sessions.filter((s) => s.status === filter);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "resolved", label: "Resolved" },
  ];

  return (
    <>
      {/* Counts + filter tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-muted-foreground">
          <span className="text-foreground font-medium">{activeCount}</span> active
          <span className="mx-1.5">/</span>
          <span className="text-emerald-400 font-medium">{resolvedCount}</span> resolved
        </div>

        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-2.5 py-1 rounded-sm text-[11px] font-medium transition-colors ${
                filter === tab.key
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtered sessions */}
      {filtered.length === 0 ? (
        <div className="rounded-sm border border-border bg-card/50 p-8 text-center">
          <p className="text-xs text-muted-foreground">
            No {filter === "all" ? "" : filter} sessions
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((session) => (
            <CouncilSessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </>
  );
}
