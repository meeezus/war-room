"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { INITIAL_EVENTS, EVENT_TYPE_COLORS, getDaimyoById } from "@/lib/data";
import type { WarEvent } from "@/lib/data";
import { timing, easing } from "@/lib/motion";
import { StealthCard } from "./stealth-card";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function EventRow({ event }: { event: WarEvent }) {
  const agent = event.agent ? getDaimyoById(event.agent) : null;
  const color = EVENT_TYPE_COLORS[event.type];

  return (
    <div className="flex gap-3 px-3 py-2 transition-colors duration-150 hover:bg-white/[0.02]">
      <span className="flex-shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.3)]">
        {formatTime(event.timestamp)}
      </span>
      <div
        className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
      />
      <div className="min-w-0 flex-1">
        {agent && (
          <span className="mr-1.5 text-xs font-medium text-[#E5E5E5]">
            {agent.emoji} {agent.name}
          </span>
        )}
        <span className="text-xs text-[rgba(255,255,255,0.5)]">{event.message}</span>
      </div>
    </div>
  );
}

export function EventFeed() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-sm font-medium uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
        Event Feed
      </h2>
      <StealthCard hover={false} className="flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto py-2"
        >
          <AnimatePresence>
            {INITIAL_EVENTS.map((event, index) => (
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
