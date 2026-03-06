"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";

interface EventItem {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

const eventColors: Record<string, string> = {
  mission_completed: "bg-green-500",
  mission_failed: "bg-red-500",
  mission_started: "bg-blue-500",
  task_completed: "bg-blue-500",
  task_started: "bg-blue-400",
  proposal_approved: "bg-purple-500",
  council_reviewed: "bg-purple-500",
  patrol_complete: "bg-amber-500",
  heartbeat: "bg-muted-foreground/40",
  discovery_created: "bg-amber-500",
  skill_applied: "bg-green-400",
};

export function EventRail() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    if (!supabase) return;

    const client = supabase;

    async function fetchEvents() {
      const { data } = await client
        .from("war_room_events")
        .select("id, event_type, title, description, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        setEvents(data as EventItem[]);
        const today = new Date().toISOString().split("T")[0];
        const todayEvents = (data as EventItem[]).filter((e) =>
          e.created_at.startsWith(today)
        );
        setTodayCount(todayEvents.length);
      }
    }

    fetchEvents();

    const channel = client
      .channel("event-rail")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "war_room_events" },
        (payload) => {
          setEvents((prev) => [payload.new as EventItem, ...prev].slice(0, 50));
          setTodayCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex h-full w-[260px] flex-col border-l border-border/50 bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_6px] shadow-green-500" />
        <span className="text-[12px] font-semibold">Live Feed</span>
        <span className="ml-auto font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
          {todayCount} today
        </span>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto py-1">
        {events.length === 0 && (
          <div className="px-4 py-6 text-center text-[11px] text-muted-foreground/50">
            No events yet
          </div>
        )}
        {events.map((event) => (
          <div
            key={event.id}
            className="flex gap-2.5 px-4 py-2 transition-colors hover:bg-foreground/[0.02]"
          >
            <span
              className={cn(
                "mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full",
                eventColors[event.event_type] ?? "bg-muted-foreground/40"
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] leading-[1.4] text-muted-foreground">
                <span className="text-muted-foreground/60">
                  {event.event_type}:
                </span>{" "}
                {event.title}
              </div>
              <div className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-muted-foreground/50">
                {formatDistanceToNowStrict(new Date(event.created_at), {
                  addSuffix: true,
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
