"use client";

import { useState, useEffect } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { SessionList } from "@/components/session-list";
import { cn } from "@/lib/utils";
import { getMissions } from "@/lib/queries";
import type { Mission } from "@/lib/types";

type StatusFilter = "all" | "active" | "completed" | "failed";
type SortOrder = "newest" | "oldest";

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

export default function SessionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getMissions();
        setMissions(data);
      } catch (err) {
        console.error("Sessions fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-[18px] font-bold tracking-tight text-foreground">
              Sessions
            </h1>

            {/* Sort toggle */}
            <button
              onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
              className="flex items-center gap-1.5 rounded-sm border border-border/50 px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              <span>{sort === "newest" ? "↓" : "↑"}</span>
              {sort === "newest" ? "Newest" : "Oldest"}
            </button>
          </div>

          {/* Filter pills */}
          <div className="mt-3 flex items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-full px-3 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] transition-colors",
                  filter === f.value
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] text-muted-foreground/50">
              Loading...
            </p>
          ) : (
            <SessionList missions={missions} filter={filter} sort={sort} />
          )}
        </div>
      </div>
    </div>
  );
}
