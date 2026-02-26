"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { AgentStatus, ActiveAgent, Event } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/data";
import { staggerContainer, staggerItem, hoverLift, tapScale, timing } from "@/lib/motion";
import { StealthCard } from "./stealth-card";
import { useRealtimeAgents, useRealtimeActiveAgents } from "@/lib/realtime";
import { getActiveAgents, getEvents } from "@/lib/queries";

const statusLabels: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  busy: "Busy",
  offline: "Offline",
};

const AGENT_STATUS_COLORS: Record<string, string> = {
  running: "#22c55e",
  idle: "#f59e0b",
  completed: "#3b82f6",
  failed: "#ef4444",
};

function ActiveAgentRow({ agent }: { agent: ActiveAgent }) {
  const clampedProgress = Math.min(100, Math.max(0, agent.progress ?? 0));
  return (
    <StealthCard className="p-3">
      <div className="flex items-start gap-2">
        <div
          className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{
            backgroundColor: AGENT_STATUS_COLORS[agent.status] ?? "#888",
            boxShadow: agent.status === "running" ? `0 0 5px ${AGENT_STATUS_COLORS[agent.status]}` : undefined,
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium text-foreground truncate">
              {agent.agent_type}
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground flex-shrink-0">
              {clampedProgress}%
            </span>
          </div>
          {agent.task_summary && (
            <p className="mt-0.5 text-[10px] text-muted-foreground truncate" title={agent.task_summary}>
              {agent.task_summary}
            </p>
          )}
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${clampedProgress}%`,
                backgroundColor: AGENT_STATUS_COLORS[agent.status] ?? "#888",
              }}
            />
          </div>
        </div>
      </div>
    </StealthCard>
  );
}

function PatrolStatus() {
  const [scanning, setScanning] = useState<string | null>(null);

  useEffect(() => {
    async function checkPatrol() {
      const events = await getEvents(20);
      // Find the latest patrol event
      const lastStarted = events.find(e => e.event_type === "patrol_started");
      const lastComplete = events.find(e => e.event_type === "patrol_complete");

      if (lastStarted && (!lastComplete || new Date(lastStarted.created_at) > new Date(lastComplete.created_at))) {
        const agents = (lastStarted.metadata?.agents as string[]) ?? [];
        setScanning(agents.length > 0 ? agents.join(", ") : "agents");
      } else {
        setScanning(null);
      }
    }
    checkPatrol();
  }, []);

  if (!scanning) return null;

  return (
    <div className="mb-2">
      <StealthCard className="p-2.5">
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400"
            style={{ boxShadow: "0 0 5px #f59e0b" }}
          />
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-amber-400">
            scanning: {scanning}
          </span>
        </div>
      </StealthCard>
    </div>
  );
}

export function AgentSidebar({ agents }: { agents: AgentStatus[] }) {
  const liveAgents = useRealtimeAgents(agents);
  const prefersReducedMotion = useReducedMotion();
  const statusOrder: Record<string, number> = { busy: 0, online: 1, idle: 2, offline: 3 };
  const sorted = [...liveAgents].sort((a, b) =>
    (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
  );

  const [initialActiveAgents, setInitialActiveAgents] = useState<ActiveAgent[]>([]);
  useEffect(() => {
    getActiveAgents().then(setInitialActiveAgents);
  }, []);
  const liveActiveAgents = useRealtimeActiveAgents(initialActiveAgents);

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-2">
      <PatrolStatus />
      {liveActiveAgents.length > 0 && (
        <div className="mb-1">
          <p className="mb-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-wider text-muted-foreground/75">
            Active Agents
          </p>
          <div className="flex flex-col gap-1.5">
            {liveActiveAgents.map((agent) => (
              <ActiveAgentRow key={agent.id} agent={agent} />
            ))}
          </div>
          <div className="my-2 border-t border-border" />
        </div>
      )}
      <motion.div
        className="flex flex-col gap-2"
        variants={prefersReducedMotion ? undefined : staggerContainer}
        initial="hidden"
        animate="show"
      >
        {sorted.map((agent) => (
          <motion.div
            key={agent.id}
            variants={prefersReducedMotion ? undefined : staggerItem}
            whileHover={
              prefersReducedMotion
                ? undefined
                : {
                    ...hoverLift,
                    transition: { duration: timing.normal / 1000 },
                  }
            }
            whileTap={prefersReducedMotion ? undefined : tapScale}
          >
            <Link href={`/agents/${agent.id}`}>
              <StealthCard className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-foreground">
                        {agent.display_name}
                      </h3>
                      <div
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: STATUS_COLORS[agent.status],
                          boxShadow: agent.status === "online" ? `0 0 6px ${STATUS_COLORS[agent.status]}` : undefined,
                        }}
                      />
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
                        {statusLabels[agent.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{agent.domain}</p>
                  </div>
                </div>
              </StealthCard>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
