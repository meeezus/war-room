"use client";

import { useEffect, useRef } from "react";
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
};

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

function EventRow({ event }: { event: Event }) {
  const color = EVENT_TYPE_COLORS[event.type] ?? "#6b7280";
  const label = event.type.replace(/_/g, " ");

  return (
    <div className="flex gap-3 px-3 py-2 transition-colors duration-150 hover:bg-white/[0.02]">
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
        {event.agent && (
          <span className="mr-1.5 text-xs font-medium text-[#E5E5E5]">
            {event.agent}
          </span>
        )}
        <span className="text-xs text-[rgba(255,255,255,0.5)]">{event.message}</span>
      </div>
    </div>
  );
}

export function EventFeed({ events }: { events: Event[] }) {
  const liveEvents = useRealtimeEvents(events);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveEvents]);

  return (
    <div className="flex h-full flex-col">
      <StealthCard hover={false} className="flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto py-2"
        >
          <AnimatePresence>
            {liveEvents.map((event, index) => (
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
        </div>
      </StealthCard>
    </div>
  );
}
