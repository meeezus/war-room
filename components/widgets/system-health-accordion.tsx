"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ServiceHealthResponse } from "@/lib/types";

interface SystemHealthAccordionProps {
  health: ServiceHealthResponse | null;
  loading?: boolean;
}

const STORAGE_KEY = "tenshu-health-accordion";

function formatServiceName(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getSummary(health: ServiceHealthResponse | null, loading?: boolean) {
  if (!health || loading) {
    return { text: "Checking services...", dot: "bg-gray-400 animate-pulse" };
  }
  switch (health.overall) {
    case "nominal":
      return { text: "All systems nominal", dot: "bg-green-500" };
    case "degraded": {
      const count = Object.values(health.services).filter((s) => !s.ok).length;
      return {
        text: `${count} service${count !== 1 ? "s" : ""} need${count === 1 ? "s" : ""} attention`,
        dot: "bg-amber-500",
      };
    }
    case "down": {
      const count = Object.values(health.services).filter((s) => !s.ok).length;
      return { text: `${count} services down`, dot: "bg-red-500" };
    }
    case "unavailable":
      return {
        text: "Local services \u2014 run dev for details",
        dot: "bg-gray-400",
      };
  }
}

export function SystemHealthAccordion({ health, loading }: SystemHealthAccordionProps) {
  const [open, setOpen] = useState(false);

  // Restore persisted state
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setOpen(true);
    } catch {
      /* SSR / no localStorage */
    }
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  const summary = getSummary(health, loading);

  return (
    <div className="border-t border-border/50">
      <button
        onClick={toggle}
        className="flex h-10 w-full items-center gap-2 px-3 text-left text-xs text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]/80"
      >
        <svg
          className={cn(
            "h-3 w-3 shrink-0 transition-transform",
            open && "rotate-90"
          )}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M4.5 2l4 4-4 4" />
        </svg>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", summary.dot)} />
        <span className="font-[family-name:var(--font-space-grotesk)]">
          {summary.text}
        </span>
      </button>

      {open && health && (
        <div className="space-y-1 px-3 pb-3">
          {Object.entries(health.services).map(([key, probe]) => (
            <div
              key={key}
              className="flex items-center gap-2 text-xs text-[var(--foreground)]/60"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  probe.ok
                    ? "bg-green-500"
                    : probe.unavailable
                      ? "bg-gray-400"
                      : "bg-red-500"
                )}
              />
              <span className="font-medium">{formatServiceName(key)}</span>
              <span className="opacity-60">{probe.detail}</span>
              {probe.latencyMs != null && (
                <span className="ml-auto tabular-nums opacity-40">
                  ({probe.latencyMs}ms)
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
