"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { AgentStatus, Mission, Event } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/data";
import {
  staggerContainer,
  staggerItem,
  fadeInUp,
  timing,
  easing,
} from "@/lib/motion";
import { StealthCard } from "./stealth-card";

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

const STATUS_ACCENT: Record<string, string> = {
  queued: "#6b7280",
  running: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444",
  stale: "#eab308",
};

const statusLabels: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  busy: "Busy",
  offline: "Offline",
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({
  status,
  colors,
}: {
  status: string;
  colors: Record<string, string>;
}) {
  const color = colors[status] ?? "#6b7280";
  return (
    <span
      className="rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {status}
    </span>
  );
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
        <span className="text-xs text-[rgba(255,255,255,0.5)]">
          {event.message}
        </span>
      </div>
    </div>
  );
}

interface AgentDetailProps {
  agent: AgentStatus;
  missions: Mission[];
  events: Event[];
}

export function AgentDetail({ agent, missions, events }: AgentDetailProps) {
  const prefersReducedMotion = useReducedMotion();
  const statusColor = STATUS_COLORS[agent.status] ?? "#6b7280";

  const currentMission = agent.current_mission_id
    ? missions.find((m) => m.id === agent.current_mission_id) ?? null
    : null;

  const pastMissions = missions.filter(
    (m) => m.id !== agent.current_mission_id
  );

  const recentEvents = events.slice(0, 20);

  return (
    <motion.div
      className="flex h-screen flex-col overflow-hidden bg-background p-4"
      {...(prefersReducedMotion ? {} : fadeInUp)}
    >
      {/* Breadcrumb */}
      <div className="mb-4 flex-shrink-0">
        <nav className="mb-3 flex items-center gap-2 text-xs text-[rgba(255,255,255,0.4)]">
          <Link
            href="/dashboard"
            className="transition-colors hover:text-[#E5E5E5]"
          >
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-[#E5E5E5]">
            Agent: {agent.display_name}
          </span>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left Column */}
        <div className="flex w-full flex-col gap-4 overflow-y-auto lg:w-1/2">
          {/* Agent Header Card */}
          <StealthCard className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-[#E5E5E5]">
                  {agent.display_name}
                </h1>
                <p className="mt-1 text-xs text-[rgba(255,255,255,0.4)]">
                  {agent.domain}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: statusColor,
                    boxShadow:
                      agent.status === "online"
                        ? `0 0 8px ${statusColor}`
                        : undefined,
                  }}
                />
                <span className="text-sm font-medium text-[#E5E5E5]">
                  {statusLabels[agent.status]}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-sm bg-white/[0.06] px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.5)]">
                {agent.model}
              </span>
              <span className="rounded-sm bg-white/[0.06] px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.5)]">
                Lv.{agent.level}
              </span>
              <span className="text-xs text-[rgba(255,255,255,0.3)]">
                Last heartbeat: {formatRelativeTime(agent.last_heartbeat)}
              </span>
              <span className="text-xs text-[rgba(255,255,255,0.3)]">
                Missions completed:{" "}
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[#E5E5E5]">
                  {agent.missions_completed}
                </span>
              </span>
            </div>
          </StealthCard>

          {/* Current Mission */}
          {currentMission && (
            <div>
              <h2 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-sm font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
                Current Mission
              </h2>
              <Link href={`/missions/${currentMission.id}`}>
                <StealthCard className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-[#E5E5E5]">
                      {currentMission.title}
                    </h3>
                    <StatusBadge
                      status={currentMission.status}
                      colors={STATUS_ACCENT}
                    />
                  </div>
                  {currentMission.started_at && (
                    <p className="mt-1 text-xs text-[rgba(255,255,255,0.3)]">
                      Started {formatRelativeTime(currentMission.started_at)}
                    </p>
                  )}
                </StealthCard>
              </Link>
            </div>
          )}

          {/* Mission History */}
          <div className="flex-1">
            <h2 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-sm font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
              Mission History
            </h2>
            {pastMissions.length === 0 ? (
              <p className="text-xs text-[rgba(255,255,255,0.3)]">
                No past missions.
              </p>
            ) : (
              <motion.div
                className="flex flex-col gap-2"
                variants={prefersReducedMotion ? undefined : staggerContainer}
                initial="hidden"
                animate="show"
              >
                {pastMissions.map((mission) => (
                  <motion.div
                    key={mission.id}
                    variants={prefersReducedMotion ? undefined : staggerItem}
                  >
                    <Link href={`/missions/${mission.id}`}>
                      <StealthCard className="p-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-[#E5E5E5]">
                            {mission.title}
                          </h3>
                          <StatusBadge
                            status={mission.status}
                            colors={STATUS_ACCENT}
                          />
                        </div>
                        <p className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.3)]">
                          {formatDate(mission.completed_at)}
                        </p>
                      </StealthCard>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Column - Recent Activity */}
        <div className="hidden flex-1 flex-col lg:flex">
          <h2 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-sm font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
            Recent Activity
          </h2>
          <StealthCard hover={false} className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto py-2">
              {recentEvents.length === 0 ? (
                <p className="px-3 py-4 text-xs text-[rgba(255,255,255,0.3)]">
                  No recent activity.
                </p>
              ) : (
                recentEvents.map((event, index) => (
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
                ))
              )}
            </div>
          </StealthCard>
        </div>
      </div>
    </motion.div>
  );
}
