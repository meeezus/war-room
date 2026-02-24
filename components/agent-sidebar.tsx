"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { AgentStatus, ActiveAgent } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/data";
import { staggerContainer, staggerItem, hoverLift, tapScale, timing } from "@/lib/motion";
import { StealthCard } from "./stealth-card";
import { useRealtimeAgents, useRealtimeActiveAgents } from "@/lib/realtime";
import { getActiveAgents } from "@/lib/queries";

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
            <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium text-[#E5E5E5] truncate">
              {agent.agent_type}
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.4)] flex-shrink-0">
              {clampedProgress}%
            </span>
          </div>
          {agent.task_summary && (
            <p className="mt-0.5 text-[10px] text-[rgba(255,255,255,0.4)] truncate" title={agent.task_summary}>
              {agent.task_summary}
            </p>
          )}
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
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
      {liveActiveAgents.length > 0 && (
        <div className="mb-1">
          <p className="mb-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.3)]">
            Active Agents
          </p>
          <div className="flex flex-col gap-1.5">
            {liveActiveAgents.map((agent) => (
              <ActiveAgentRow key={agent.id} agent={agent} />
            ))}
          </div>
          <div className="my-2 border-t border-white/[0.06]" />
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
                      <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-[#E5E5E5]">
                        {agent.display_name}
                      </h3>
                      <div
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: STATUS_COLORS[agent.status],
                          boxShadow: agent.status === "online" ? `0 0 6px ${STATUS_COLORS[agent.status]}` : undefined,
                        }}
                      />
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.4)]">
                        {statusLabels[agent.status]}
                      </span>
                    </div>
                    <p className="text-xs text-[rgba(255,255,255,0.4)]">{agent.domain}</p>
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
