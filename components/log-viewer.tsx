"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";

const LOG_LEVELS: Record<string, { level: string; color: string }> = {
  mission_failed: { level: "error", color: "#ef4444" },
  task_failed: { level: "error", color: "#ef4444" },
  step_failed: { level: "error", color: "#ef4444" },
  mission_started: { level: "info", color: "#3b82f6" },
  mission_completed: { level: "success", color: "#22c55e" },
  task_completed: { level: "success", color: "#22c55e" },
  task_started: { level: "info", color: "#6366f1" },
  heartbeat: { level: "debug", color: "#6b7280" },
  proposal_approved: { level: "info", color: "#a855f7" },
  proposal_created: { level: "info", color: "#a855f7" },
  patrol_complete: { level: "info", color: "#f59e0b" },
  discovery_created: { level: "info", color: "#3b82f6" },
  skill_applied: { level: "success", color: "#22c55e" },
};

function getLogMeta(eventType: string) {
  return LOG_LEVELS[eventType] ?? { level: "info", color: "#6b7280" };
}

type LogEntry = {
  id: string;
  event_type: string;
  title: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const allTypes = ["all", ...Array.from(new Set(logs.map((l) => l.event_type))).sort()];

  const filtered = logs.filter((log) => {
    if (filterType !== "all" && log.event_type !== filterType) return false;
    if (search && !log.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (autoScroll) scrollToBottom();
  }, [filtered.length, autoScroll, scrollToBottom]);

  useEffect(() => {
    async function fetchLogs() {
      if (!supabase) return;
      const { data } = await supabase
        .from("war_room_events")
        .select("id, event_type, title, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setLogs(data as LogEntry[]);
      setLoading(false);
    }
    fetchLogs();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("log-viewer-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "war_room_events" },
        (payload) => {
          setLogs((prev) => [payload.new as LogEntry, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, []);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-4">
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-[15px] font-semibold tracking-tight">
          Log Viewer
        </h1>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 border-b border-border/50 px-6 py-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="font-[family-name:var(--font-jetbrains-mono)] rounded border border-border/50 bg-surface px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-border"
        >
          {allTypes.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All types" : t}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="font-[family-name:var(--font-jetbrains-mono)] flex-1 rounded border border-border/50 bg-surface px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-border"
        />

        <label className="flex cursor-pointer items-center gap-1.5">
          <div
            onClick={() => setAutoScroll((v) => !v)}
            className={cn(
              "h-3.5 w-6 rounded-full transition-colors",
              autoScroll ? "bg-green-500/70" : "bg-muted-foreground/30"
            )}
          >
            <div
              className={cn(
                "h-3.5 w-3.5 rounded-full border border-border/50 bg-background shadow transition-transform",
                autoScroll ? "translate-x-2.5" : "translate-x-0"
              )}
            />
          </div>
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
            auto-scroll
          </span>
        </label>
      </div>

      {/* Stats line */}
      <div className="border-b border-border/30 px-6 py-1.5">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/60">
          Showing {filtered.length} of {logs.length} logs
        </span>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/50">
              Loading...
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/50">
              No logs found
            </span>
          </div>
        ) : (
          [...filtered].reverse().map((log) => {
            const meta = getLogMeta(log.event_type);
            const isExpanded = expandedIds.has(log.id);
            return (
              <div
                key={log.id}
                className={cn(
                  "cursor-pointer border-b border-border/20 px-6 py-2 transition-colors hover:bg-surface/60",
                  isExpanded && "bg-surface/40"
                )}
                style={{ borderLeft: `4px solid ${meta.color}` }}
                onClick={() => toggleExpand(log.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Timestamp */}
                  <span className="font-[family-name:var(--font-jetbrains-mono)] mt-[1px] shrink-0 text-[10px] text-muted-foreground/50">
                    {formatDistanceToNowStrict(new Date(log.created_at), { addSuffix: true })}
                  </span>

                  {/* Type badge */}
                  <span
                    className="font-[family-name:var(--font-jetbrains-mono)] mt-[1px] shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide"
                    style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
                  >
                    {log.event_type}
                  </span>

                  {/* Summary */}
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[11px] text-foreground/80">
                    {log.title ?? "—"}
                  </span>
                </div>

                {/* Expandable metadata */}
                {isExpanded && log.metadata && (
                  <div className="mt-2 ml-[calc(4rem+6px)]">
                    <pre className="font-[family-name:var(--font-jetbrains-mono)] overflow-x-auto rounded border border-border/30 bg-background/60 p-3 text-[10px] text-muted-foreground/80">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
