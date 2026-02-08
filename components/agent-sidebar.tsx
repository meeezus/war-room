"use client";

import { motion, useReducedMotion } from "motion/react";
import { DAIMYO, STATUS_COLORS } from "@/lib/data";
import { staggerContainer, staggerItem, hoverLift, tapScale, timing } from "@/lib/motion";
import { StealthCard } from "./stealth-card";

const statusLabels: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  busy: "Busy",
  offline: "Offline",
};

export function AgentSidebar() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-2">
      <h2 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-sm font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
        Daimyo Council
      </h2>
      <motion.div
        className="flex flex-col gap-2"
        variants={prefersReducedMotion ? undefined : staggerContainer}
        initial="hidden"
        animate="show"
      >
        {DAIMYO.map((agent) => (
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
            <StealthCard className="p-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl" role="img" aria-label={agent.name}>
                  {agent.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-[#E5E5E5]">
                      {agent.name}
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
                  {agent.currentTask && (
                    <p className="mt-1.5 truncate text-xs text-[#10b981]/70">
                      {agent.currentTask}
                    </p>
                  )}
                </div>
              </div>
            </StealthCard>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
