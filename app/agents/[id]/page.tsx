"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getAgentWithHistory } from "@/lib/queries";
import { getRpgStats, getBaselineStats } from "@/lib/rpg-stats";
import { getRoleCard } from "@/lib/role-cards";
import type { AgentStatus, Mission, Event, RpgStats, RoleCard } from "@/lib/types";
import { StealthCard } from "@/components/stealth-card";
import { RpgStatBar } from "@/components/rpg-stat-bar";

const AGENT_AVATARS: Record<string, string> = {
  'pip': '/agents/cc.png',
  'cc': '/agents/cc.png',
  'ed': '/agents/ed.png',
  'light': '/agents/light.png',
  'toji': '/agents/toji.png',
  'power': '/agents/makima.png',
  'makima': '/agents/makima.png',
  'major': '/agents/major.png',
};

const STATUS_ICONS: Record<string, string> = {
  completed: "\u2705",
  running: "\uD83D\uDD04",
  queued: "\u23F3",
  failed: "\u274C",
  stale: "\u26A0\uFE0F",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  online: "#10b981",
  idle: "#eab308",
  busy: "#3b82f6",
  offline: "#6b7280",
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ConnectPrompt() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <StealthCard className="max-w-md p-8 text-center">
        <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-[#E5E5E5]">
          Connect Supabase to see live data
        </h2>
        <p className="mb-4 text-sm text-[rgba(255,255,255,0.5)]">
          Add environment variables to{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs">
            .env.local
          </code>
        </p>
      </StealthCard>
    </div>
  );
}

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<RpgStats>(getBaselineStats());
  const [roleCard, setRoleCard] = useState<RoleCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [historyData, rpgStats] = await Promise.all([
        getAgentWithHistory(id),
        getRpgStats(id),
      ]);
      setAgent(historyData.agent);
      setMissions(historyData.missions);
      setEvents(historyData.events);
      setStats(rpgStats);
      setRoleCard(getRoleCard(id));
      setLoading(false);
    }
    fetchData();
  }, [id]);

  if (!supabase) return <ConnectPrompt />;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-[rgba(255,255,255,0.4)]">
          Loading...
        </p>
      </div>
    );
  }

  if (!agent || !roleCard) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <StealthCard className="max-w-sm p-8 text-center">
          <h2 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-[#E5E5E5]">
            Agent not found
          </h2>
          <p className="text-sm text-[rgba(255,255,255,0.4)]">
            No agent with ID{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs">
              {id}
            </code>
          </p>
        </StealthCard>
      </div>
    );
  }

  const statusDotColor = STATUS_DOT_COLORS[agent.status] ?? "#6b7280";
  const recentEvents = events.slice(0, 20);

  return (
    <div className="min-h-screen bg-zinc-950 p-4 sm:p-6 lg:p-8">
      {/* Navigation */}
      <nav className="mb-6 flex items-center gap-4 text-sm">
        <Link
          href="/dashboard"
          className="text-emerald-400 transition-colors hover:text-emerald-300"
        >
          &larr; Dashboard
        </Link>
        <Link
          href="/dojo"
          className="text-emerald-400 transition-colors hover:text-emerald-300"
        >
          &larr; Dojo
        </Link>
      </nav>

      <div className="mx-auto max-w-4xl space-y-6">
        {/* Hero Section */}
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          {/* Avatar Card */}
          <StealthCard className="flex flex-col items-center justify-center p-6">
            <div className="size-[128px] overflow-hidden rounded-full border-2 border-zinc-700">
              <Image
                src={AGENT_AVATARS[roleCard.id] || AGENT_AVATARS[id] || '/agents/cc.png'}
                alt={roleCard.name}
                width={128}
                height={128}
                className="size-full object-cover"
              />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: statusDotColor,
                  boxShadow: agent.status === "online" ? `0 0 8px ${statusDotColor}` : undefined,
                }}
              />
              <span className="text-sm capitalize text-[rgba(255,255,255,0.6)]">
                {agent.status}
              </span>
            </div>
            <p className="mt-2 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[rgba(255,255,255,0.4)]">
              XP: {stats.totalXP}
            </p>
          </StealthCard>

          {/* Info Card */}
          <StealthCard className="p-6">
            <h1 className="text-balance font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-[#E5E5E5]">
              {roleCard.name}{" "}
              <span className="text-[rgba(255,255,255,0.3)]">&mdash;</span>{" "}
              <span style={{ color: roleCard.color }}>{roleCard.title}</span>
            </h1>
            <p className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-sm text-[rgba(255,255,255,0.5)]">
              {roleCard.class} &middot; Lv.{stats.level}
            </p>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-[rgba(255,255,255,0.5)]">
              {roleCard.description}
            </p>

            <div className="mt-5">
              <h3 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
                Abilities
              </h3>
              <ul className="space-y-1">
                {roleCard.abilities.map((ability) => (
                  <li
                    key={ability}
                    className="text-sm text-[rgba(255,255,255,0.6)]"
                  >
                    <span style={{ color: roleCard.color }}>&bull;</span>{" "}
                    {ability}
                  </li>
                ))}
              </ul>
            </div>
          </StealthCard>
        </div>

        {/* Stats Panel */}
        <StealthCard className="p-6">
          <h2 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-sm font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
            Stats
          </h2>
          <div className="space-y-3">
            <RpgStatBar label="TRU" value={stats.TRU} color={roleCard.color} size="lg" />
            <RpgStatBar label="SPD" value={stats.SPD} color={roleCard.color} size="lg" />
            <RpgStatBar label="WIS" value={stats.WIS} color={roleCard.color} size="lg" />
            <RpgStatBar label="PWR" value={stats.PWR} color={roleCard.color} size="lg" />
          </div>
        </StealthCard>

        {/* Mission History */}
        <StealthCard className="p-6">
          <h2 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-sm font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
            Mission History{" "}
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[rgba(255,255,255,0.3)]">
              ({missions.length} total)
            </span>
          </h2>
          {missions.length === 0 ? (
            <p className="text-xs text-[rgba(255,255,255,0.3)]">No missions yet.</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {missions.map((mission) => (
                <Link
                  key={mission.id}
                  href={`/missions/${mission.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex-shrink-0 text-sm">
                      {STATUS_ICONS[mission.status] ?? "\u2753"}
                    </span>
                    <span className="truncate text-sm text-[#E5E5E5]">
                      {mission.title}
                    </span>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase"
                      style={{
                        backgroundColor: `${statusAccent(mission.status)}20`,
                        color: statusAccent(mission.status),
                      }}
                    >
                      {mission.status}
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[rgba(255,255,255,0.3)]">
                      {mission.completed_at
                        ? timeAgo(mission.completed_at)
                        : mission.started_at
                          ? timeAgo(mission.started_at)
                          : timeAgo(mission.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </StealthCard>

        {/* Recent Events */}
        <StealthCard className="p-6">
          <h2 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-sm font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
            Recent Events{" "}
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[rgba(255,255,255,0.3)]">
              (last 20)
            </span>
          </h2>
          {recentEvents.length === 0 ? (
            <p className="text-xs text-[rgba(255,255,255,0.3)]">No recent events.</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {recentEvents.map((event) => {
                const evtColor = eventColor(event.type);
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 py-2.5"
                  >
                    <div
                      className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: evtColor, boxShadow: `0 0 4px ${evtColor}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <span
                        className="mr-1.5 rounded-sm px-1 py-0.5 text-[10px] font-medium uppercase"
                        style={{ backgroundColor: `${evtColor}20`, color: evtColor }}
                      >
                        {event.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-[rgba(255,255,255,0.5)]">
                        {event.message}
                      </span>
                    </div>
                    <span className="flex-shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[rgba(255,255,255,0.3)]">
                      {timeAgo(event.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </StealthCard>
      </div>
    </div>
  );
}

function statusAccent(status: string): string {
  const map: Record<string, string> = {
    queued: "#6b7280",
    running: "#3b82f6",
    completed: "#10b981",
    failed: "#ef4444",
    stale: "#eab308",
  };
  return map[status] ?? "#6b7280";
}

function eventColor(type: string): string {
  const map: Record<string, string> = {
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
  return map[type] ?? "#6b7280";
}
