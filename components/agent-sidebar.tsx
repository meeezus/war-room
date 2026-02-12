"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { AgentStatus } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/data";
import { staggerContainer, staggerItem, hoverLift, tapScale, timing } from "@/lib/motion";
import { StealthCard } from "./stealth-card";
import { useRealtimeAgents } from "@/lib/realtime";
import { MessageSquare, Zap } from "lucide-react";

const statusLabels: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  busy: "Busy",
  offline: "Offline",
};

export function AgentSidebar({ agents }: { agents: AgentStatus[] }) {
  const liveAgents = useRealtimeAgents(agents);
  const prefersReducedMotion = useReducedMotion();
  const statusOrder: Record<string, number> = { busy: 0, online: 1, idle: 2, offline: 3 };
  const sorted = [...liveAgents].sort((a, b) =>
    (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
  );

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-2">
      {/* Chat Navigation */}
      <Link href="/chat">
        <StealthCard className="p-3 mb-2 border-primary/20 hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-[#E5E5E5]">
                Shoin Chat
              </h3>
              <p className="text-xs text-[rgba(255,255,255,0.4)]">Real-time Daimyo council</p>
            </div>
            <MessageSquare className="h-4 w-4 text-[rgba(255,255,255,0.3)]" />
          </div>
        </StealthCard>
      </Link>

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
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.3)]">
                        Lv.{agent.level}
                      </span>
                    </div>
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
