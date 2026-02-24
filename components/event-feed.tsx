"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import type { Event } from "@/lib/types";
import { timing, easing } from "@/lib/motion";
import { StealthCard } from "./stealth-card";
import { useRealtimeEvents } from "@/lib/realtime";

const EVENT_TYPE_COLORS: Record<string, string> = {
  proposal_created: "#a855f7",
  proposal_approved: "#10b981",
  proposal_rejected: "#ef4444",
  mission_started: "#3b82f6",
  mission_completed: "#10b981",
  mission_failed: "#ef4444",
  step_started: "#6366f1",
  step_completed: "#10b981",
  step_failed: "#ef4444",
  step_stale: "#eab308",
  heartbeat: "#6b7280",
  agent_action: "#3b82f6",
  user_request: "#a855f7",
  task_created: "#8b5cf6",
  task_started: "#6366f1",
  task_completed: "#10b981",
  task_failed: "#ef4444",
  task_updated: "#f59e0b",
  skill_patch_extracted: "#8b5cf6",
  skill_applied: "#22c55e",
  skill_sunset: "#6b7280",
  patrol_started: "#f59e0b",
  patrol_complete: "#10b981",
  discovery_created: "#3b82f6",
  discovery_approved: "#10b981",
  discovery_dismissed: "#6b7280",
  cross_pollination: "#a855f7",
};

type FilterCategory = "all" | "proposals" | "missions" | "tasks" | "system";

const FILTER_TYPES: Record<FilterCategory, string[] | null> = {
  all: null, // special: everything except heartbeat
  proposals: ["proposal_created", "proposal_approved", "proposal_rejected"],
  missions: ["mission_started", "mission_completed", "mission_failed"],
  tasks: [
    "task_started", "task_completed", "task_failed", "task_updated", "task_created",
    "step_started", "step_completed", "step_failed", "step_stale",
  ],
  system: ["heartbeat", "user_request", "agent_action", "council_reviewed", "skill_patch_extracted", "skill_applied", "skill_sunset", "cross_pollination"],
};

const NEEDS_YOU_TYPES = new Set([
  "step_failed", "mission_failed", "task_failed", "proposal_rejected", "step_stale",
]);
const ACTIVE_TYPES = new Set([
  "mission_started", "step_started", "task_started", "task_updated", "task_created", "agent_action",
  "patrol_started", "discovery_created",
]);
const COMPLETE_TYPES = new Set([
  "mission_completed", "step_completed", "task_completed",
  "proposal_approved", "proposal_created", "council_reviewed",
  "skill_patch_extracted", "skill_applied", "patrol_complete",
  "discovery_approved", "discovery_dismissed", "cross_pollination",
]);
const SYSTEM_TYPES = new Set(["heartbeat", "user_request", "skill_sunset"]);

type ZoneKey = "needs_you" | "active" | "complete";

interface ZoneConfig {
  key: ZoneKey;
  label: string;
  indicator: string;
  indicatorColor: string;
}

const ZONES: ZoneConfig[] = [
  { key: "needs_you", label: "Needs You", indicator: "\u25CF", indicatorColor: "#ef4444" },
  { key: "active", label: "Active", indicator: "\u25CF", indicatorColor: "#f59e0b" },
  { key: "complete", label: "Complete", indicator: "\u25CF", indicatorColor: "#10b981" },
];

function classifyEvent(event: Event): ZoneKey | null {
  if (NEEDS_YOU_TYPES.has(event.type)) return "needs_you";
  if (ACTIVE_TYPES.has(event.type)) return "active";
  if (COMPLETE_TYPES.has(event.type)) return "complete";
  if (SYSTEM_TYPES.has(event.type)) return null; // hidden by default unless "system" filter
  return "active"; // fallback for unknown types
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function PatrolCompleteRow({ event, color }: { event: Event; color: string }) {
  const [expanded, setExpanded] = useState(false);
  const meta = event.metadata ?? {};
  const count = (meta.discovery_count as number) ?? 0;
  const agents = (meta.agents_scanned as string[]) ?? [];
  const discoveries = (meta.discoveries as Array<{ severity: string; title: string }>) ?? [];

  const critical = discoveries.filter(d => d.severity === "critical").length;
  const warning = discoveries.filter(d => d.severity === "warning").length;
  const info = discoveries.filter(d => d.severity === "info").length;

  return (
    <div
      className="flex gap-3 px-3 py-2 transition-colors duration-150 hover:bg-white/[0.02] cursor-pointer select-none"
      onClick={() => setExpanded(v => !v)}
    >
      <span className="flex-shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.3)]">
        {formatRelativeTime(event.created_at)}
      </span>
      <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
      <div className="min-w-0 flex-1">
        <span className="mr-1.5 rounded-sm px-1 py-0.5 text-[10px] font-medium uppercase" style={{ backgroundColor: `${color}20`, color }}>
          patrol complete
        </span>
        <span className="text-xs text-[rgba(255,255,255,0.5)]">
          {count} discover{count === 1 ? "y" : "ies"}
          {agents.length > 0 && ` · ${agents.join(", ")}`}
        </span>
        {count > 0 && (
          <span className="ml-1.5 text-[10px] text-[rgba(255,255,255,0.2)]">
            {expanded ? "▼" : "▶"}
          </span>
        )}
        {expanded && discoveries.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-0.5">
            {critical > 0 && <span className="text-[10px] text-red-400">{critical} critical</span>}
            {warning > 0 && <span className="text-[10px] text-amber-400">{warning} warning</span>}
            {info > 0 && <span className="text-[10px] text-blue-400">{info} info</span>}
            {discoveries.slice(0, 5).map((d, i) => (
              <span key={i} className="text-[10px] text-[rgba(255,255,255,0.3)] truncate">
                · {d.title}
              </span>
            ))}
            {discoveries.length > 5 && (
              <span className="text-[10px] text-[rgba(255,255,255,0.2)]">
                +{discoveries.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: Event }) {
  const [expanded, setExpanded] = useState(false);
  const color = EVENT_TYPE_COLORS[event.type] ?? "#6b7280";
  const label = event.type.replace(/_/g, " ");

  if (event.type === "patrol_complete") {
    return <PatrolCompleteRow event={event} color={color} />;
  }

  // Rich labels for patrol/discovery/skill events
  let richMessage = event.message;
  if (event.type === "patrol_started") {
    const agents = (event.metadata?.agents as string[]) ?? [];
    richMessage = agents.length > 0
      ? `Patrol started: ${agents.join(", ")} scanning`
      : event.message;
  } else if (event.type === "discovery_approved") {
    const title = event.metadata?.title as string;
    richMessage = title ? `Discovery approved: ${title}` : event.message;
  } else if (event.type === "discovery_dismissed") {
    const title = event.metadata?.title as string;
    richMessage = title ? `Discovery dismissed: ${title}` : event.message;
  } else if (event.type === "skill_patch_extracted") {
    const preview = event.metadata?.content_preview as string;
    richMessage = preview ? `learned: ${preview}` : event.message;
  } else if (event.type === "skill_applied") {
    const count = event.metadata?.patch_count as number;
    richMessage = count != null
      ? `promoted ${count} pattern${count === 1 ? "" : "s"} to SKILL file`
      : event.message;
  }

  return (
    <div
      className="flex gap-3 px-3 py-2 transition-colors duration-150 hover:bg-white/[0.02] cursor-pointer select-none"
      onClick={() => setExpanded((v) => !v)}
    >
      <span className="flex-shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.3)]">
        {formatRelativeTime(event.created_at)}
      </span>
      <div
        className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
      />
      <div className="min-w-0 flex-1">
        <span
          className="mr-1.5 rounded-sm px-1 py-0.5 text-[10px] font-medium uppercase"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {label}
        </span>
        {expanded ? (
          <>
            {event.agent && (
              <span className="mr-1.5 text-xs font-medium text-[#E5E5E5]">
                {event.agent}
              </span>
            )}
            <span className="text-xs text-[rgba(255,255,255,0.5)]">{event.message}</span>
          </>
        ) : (
          <span className="text-xs text-[rgba(255,255,255,0.3)] truncate">
            {event.agent ? `${event.agent} — ` : ""}{richMessage}
          </span>
        )}
      </div>
    </div>
  );
}

function ZoneHeader({
  zone,
  count,
  collapsed,
  onToggle,
}: {
  zone: ZoneConfig;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-white/[0.03]"
    >
      <span
        className="text-[10px]"
        style={{ color: zone.indicatorColor }}
      >
        {zone.indicator}
      </span>
      <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium text-[rgba(255,255,255,0.6)]">
        {zone.label}
      </span>
      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.3)]">
        {count}
      </span>
      <span className="ml-auto text-[10px] text-[rgba(255,255,255,0.2)]">
        {collapsed ? "\u25B6" : "\u25BC"}
      </span>
    </button>
  );
}

export function EventFeed({ events }: { events: Event[] }) {
  const liveEvents = useRealtimeEvents(events);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [clearedAt, setClearedAt] = useState<number>(0);
  const [collapsedZones, setCollapsedZones] = useState<Record<ZoneKey, boolean>>({
    needs_you: false,
    active: false,
    complete: false,
  });

  // Apply clear: only show events created after clearedAt
  const visibleEvents = liveEvents.filter((e) => {
    if (clearedAt > 0 && new Date(e.created_at).getTime() < clearedAt) return false;
    return true;
  });

  // Apply filter
  const filteredEvents = visibleEvents.filter((e) => {
    if (filter === "all") return e.type !== "heartbeat";
    if (filter === "system") return FILTER_TYPES.system!.includes(e.type);
    return FILTER_TYPES[filter]!.includes(e.type);
  });

  // Group into zones
  const grouped: Record<ZoneKey, Event[]> = {
    needs_you: [],
    active: [],
    complete: [],
  };

  for (const event of filteredEvents) {
    // In system filter mode, show everything in active zone
    if (filter === "system") {
      grouped.active.push(event);
      continue;
    }
    const zone = classifyEvent(event);
    if (zone) {
      grouped[zone].push(event);
    }
  }

  const toggleZone = (key: ZoneKey) => {
    setCollapsedZones((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveEvents]);

  const totalVisible = filteredEvents.length;

  return (
    <div className="flex h-full flex-col">
      <StealthCard hover={false} className="flex-1 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterCategory)}
            className="appearance-none rounded bg-white/[0.04] px-2 py-1 font-[family-name:var(--font-space-grotesk)] text-xs text-[rgba(255,255,255,0.6)] outline-none ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.06] focus:ring-white/[0.15]"
          >
            <option value="all">All</option>
            <option value="proposals">Proposals</option>
            <option value="missions">Missions</option>
            <option value="tasks">Tasks</option>
            <option value="system">System</option>
          </select>
          <div className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.25)]">
              {totalVisible} events
            </span>
            <button
              onClick={() => setClearedAt(Date.now())}
              className="rounded px-2 py-0.5 font-[family-name:var(--font-space-grotesk)] text-[10px] text-[rgba(255,255,255,0.3)] transition-colors hover:bg-white/[0.06] hover:text-[rgba(255,255,255,0.5)]"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Event list with zones */}
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto py-1"
        >
          {ZONES.map((zone) => {
            const zoneEvents = grouped[zone.key];
            if (zoneEvents.length === 0) return null;
            const isCollapsed = collapsedZones[zone.key];

            return (
              <div key={zone.key}>
                <ZoneHeader
                  zone={zone}
                  count={zoneEvents.length}
                  collapsed={isCollapsed}
                  onToggle={() => toggleZone(zone.key)}
                />
                {!isCollapsed && (
                  <AnimatePresence>
                    {zoneEvents.map((event, index) => (
                      <motion.div
                        key={event.id}
                        initial={
                          prefersReducedMotion
                            ? false
                            : { opacity: 0, x: 20 }
                        }
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: timing.deliberate / 1000,
                          ease: easing.entrance,
                          delay: prefersReducedMotion ? 0 : index * 0.03,
                        }}
                      >
                        <EventRow event={event} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            );
          })}

          {totalVisible === 0 && (
            <div className="px-3 py-8 text-center font-[family-name:var(--font-space-grotesk)] text-xs text-[rgba(255,255,255,0.2)]">
              No events
            </div>
          )}
        </div>
      </StealthCard>
    </div>
  );
}
