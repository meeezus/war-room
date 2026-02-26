"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { AgentStatus, Event, ActiveWorker, Mission } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/data";
import { staggerContainer, staggerItem, hoverLift, tapScale, timing } from "@/lib/motion";
import { StealthCard } from "./stealth-card";
import { useRealtimeAgents } from "@/lib/realtime";
import { getEvents, getActiveWorkers, getDaimyoActivity } from "@/lib/queries";

const statusLabels: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  busy: "Busy",
  offline: "Offline",
};

const AGENT_COLORS: Record<string, string> = {
  ed: "#3b82f6",
  light: "#a855f7",
  armin: "#22c55e",
  nanami: "#f59e0b",
  major: "#ef4444",
  makima: "#a855f7",
  toji: "#f59e0b",
};

// Map task kind → worker archetype label
function getWorkerType(kind: ActiveWorker["kind"]): { label: string; color: string } {
  switch (kind) {
    case "code":
    case "deploy":
      return { label: "Samurai", color: "#3b82f6" };
    case "research":
    case "analyze":
      return { label: "Ronin", color: "#a855f7" };
    case "review":
    case "test":
      return { label: "Ninja", color: "#22c55e" };
    default:
      return { label: "Ashigaru", color: "#f59e0b" };
  }
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return "--";
  const ms = Date.now() - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function WorkerCard({ worker }: { worker: ActiveWorker }) {
  const { label, color } = getWorkerType(worker.kind);
  const [elapsed, setElapsed] = useState(() => formatElapsed(worker.started_at));

  useEffect(() => {
    if (!worker.started_at) return;
    const interval = setInterval(() => {
      setElapsed(formatElapsed(worker.started_at));
    }, 10000);
    return () => clearInterval(interval);
  }, [worker.started_at]);

  const agentColor = worker.daimyo ? (AGENT_COLORS[worker.daimyo] ?? "#888") : "#888";

  return (
    <StealthCard className="p-3">
      <div className="flex items-start gap-2">
        <div
          className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: "#22c55e", boxShadow: "0 0 5px #22c55e" }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span
              className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {label}
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground flex-shrink-0">
              {elapsed}
            </span>
          </div>
          <p className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium text-foreground truncate" title={worker.title}>
            {worker.title}
          </p>
          {worker.daimyo && (
            <p
              className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] mt-0.5"
              style={{ color: agentColor }}
            >
              {worker.daimyo}
            </p>
          )}
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
      const lastStarted = events.find((e: Event) => e.event_type === "patrol_started");
      const lastComplete = events.find((e: Event) => e.event_type === "patrol_complete");

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

interface AgentSidebarProps {
  agents: AgentStatus[]
  missions?: Mission[]
  activeWorkers?: ActiveWorker[]
  daimyoActivity?: Record<string, number>
}

export function AgentSidebar({ agents, missions, activeWorkers: initialActiveWorkers, daimyoActivity: initialDaimyoActivity }: AgentSidebarProps) {
  const liveAgents = useRealtimeAgents(agents);
  const prefersReducedMotion = useReducedMotion();

  const statusOrder: Record<string, number> = { busy: 0, online: 1, idle: 2, offline: 3 };
  const sorted = [...liveAgents].sort((a, b) =>
    (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
  );

  // Active workers from tasks table (status = in_progress)
  const [activeWorkers, setActiveWorkers] = useState<ActiveWorker[]>(initialActiveWorkers ?? []);
  const [daimyoActivity, setDaimyoActivity] = useState<Record<string, number>>(initialDaimyoActivity ?? {});

  useEffect(() => {
    if (!initialActiveWorkers) {
      getActiveWorkers().then(setActiveWorkers);
    }
    if (!initialDaimyoActivity) {
      getDaimyoActivity().then(setDaimyoActivity);
    }
  }, [initialActiveWorkers, initialDaimyoActivity]);

  // Refresh workers every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      getActiveWorkers().then(setActiveWorkers);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-2">
      <PatrolStatus />

      {/* Active Workers section */}
      <div className="mb-1">
        <div className="flex items-center justify-between mb-1.5">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-wider text-muted-foreground/75">
            Active Workers
          </p>
          {activeWorkers.length > 0 && (
            <span
              className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: "#22c55e20", color: "#22c55e" }}
            >
              {activeWorkers.length}
            </span>
          )}
        </div>
        {activeWorkers.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {activeWorkers.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} />
            ))}
          </div>
        ) : (
          <StealthCard className="p-3">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/50 text-center">
              No active workers
            </p>
          </StealthCard>
        )}
        <div className="my-2 border-t border-border" />
      </div>

      {/* Daimyo section */}
      <div>
        <p className="mb-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-wider text-muted-foreground/75">
          Daimyo
        </p>
        <motion.div
          className="flex flex-col gap-2"
          variants={prefersReducedMotion ? undefined : staggerContainer}
          initial="hidden"
          animate="show"
        >
          {sorted.map((agent) => {
            const agentColor = AGENT_COLORS[agent.id] ?? "#888";
            const recentActivity = daimyoActivity[agent.id] ?? 0;

            return (
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
                          <h3
                            className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium"
                            style={{ color: agentColor }}
                          >
                            {agent.display_name}
                          </h3>
                          <div
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: STATUS_COLORS[agent.status],
                              boxShadow: agent.status === "online" || agent.status === "busy"
                                ? `0 0 6px ${STATUS_COLORS[agent.status]}`
                                : undefined,
                            }}
                          />
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
                            {statusLabels[agent.status]}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{agent.domain}</p>
                        {recentActivity > 0 && (
                          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/60 mt-0.5">
                            {recentActivity} mission{recentActivity !== 1 ? "s" : ""} this week
                          </p>
                        )}
                      </div>
                    </div>
                  </StealthCard>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
