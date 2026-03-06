"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { StealthCard } from "@/components/stealth-card";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<AgentStatus["status"], string> = {
  online:  "bg-green-500 shadow-[0_0_4px] shadow-green-500",
  busy:    "bg-amber-500 shadow-[0_0_4px] shadow-amber-500",
  idle:    "bg-blue-500/60",
  offline: "bg-muted-foreground/30",
};

const STATUS_LABEL: Record<AgentStatus["status"], string> = {
  online:  "online",
  busy:    "busy",
  idle:    "idle",
  offline: "offline",
};

const STATUS_TEXT: Record<AgentStatus["status"], string> = {
  online:  "text-green-500",
  busy:    "text-amber-500",
  idle:    "text-blue-400",
  offline: "text-muted-foreground/40",
};

const DOMAIN_COLORS: Record<string, string> = {
  engineering:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  product:       "bg-purple-500/10 text-purple-400 border-purple-500/20",
  commerce:      "bg-green-500/10 text-green-400 border-green-500/20",
  influence:     "bg-pink-500/10 text-pink-400 border-pink-500/20",
  operations:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  coordination:  "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

function domainBadgeClass(domain: string): string {
  return DOMAIN_COLORS[domain] ?? "bg-muted/30 text-muted-foreground border-border/40";
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

// ─── AgentCard ────────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: AgentStatus;
}

export function AgentCard({ agent }: AgentCardProps) {
  const dotClass = STATUS_DOT[agent.status];
  const labelClass = STATUS_TEXT[agent.status];

  return (
    <Link href={`/agents/${agent.name}`}>
      <StealthCard className="p-3 cursor-pointer">
        {/* Header row */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-foreground leading-snug">
              {agent.display_name || agent.name}
            </p>
            <span
              className={cn(
                "mt-0.5 inline-block rounded-sm border px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-wide",
                domainBadgeClass(agent.domain)
              )}
            >
              {agent.domain}
            </span>
          </div>

          {/* Status indicator */}
          <div className="flex flex-shrink-0 items-center gap-1.5 pt-0.5">
            <span className={cn("size-1.5 rounded-full", dotClass)} />
            <span className={cn("font-[family-name:var(--font-jetbrains-mono)] text-[10px]", labelClass)}>
              {STATUS_LABEL[agent.status]}
            </span>
          </div>
        </div>

        {/* Current mission */}
        <div className="mb-2 min-h-[1.5rem]">
          {agent.current_mission_id ? (
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-amber-400/80 truncate">
              {agent.current_mission_id}
            </p>
          ) : (
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/40">
              no active mission
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between border-t border-border/30 pt-2">
          <div className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
              <span className="text-foreground/60">{agent.missions_completed}</span>
              {" "}missions
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
              Lv<span className="text-foreground/60">{agent.level}</span>
            </span>
          </div>
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/50 tabular-nums">
            {relativeTime(agent.last_heartbeat)}
          </span>
        </div>
      </StealthCard>
    </Link>
  );
}

// ─── AgentGrid ────────────────────────────────────────────────────────────────

interface AgentGridProps {
  agents: AgentStatus[];
}

export function AgentGrid({ agents }: AgentGridProps) {
  if (agents.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground/50">
          No agents found.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
