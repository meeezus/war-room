"use client";

import { cn } from "@/lib/utils";
import { StealthCard } from "@/components/stealth-card";
import type { SystemFitness } from "@/lib/types";

interface LearningsFeedProps {
  fitness: SystemFitness | null;
  insights?: { content: string; created_at: string; id: string }[];
}

const trendConfig = {
  improving: { bg: "bg-green-500/10 border-green-500/20", text: "text-green-400", arrow: "\u2191" },
  stable: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400", arrow: "\u2192" },
  degrading: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-400", arrow: "\u2193" },
} as const;

export function LearningsFeed({ fitness, insights }: LearningsFeedProps) {
  return (
    <StealthCard className="p-3" hover={false}>
      {/* Fitness digest banner */}
      {fitness ? (
        <div
          data-testid="fitness-banner"
          className={cn(
            "rounded-sm border px-3 py-2",
            trendConfig[fitness.missRateTrend].bg
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "font-[family-name:var(--font-jetbrains-mono)] text-xs leading-snug",
                trendConfig[fitness.missRateTrend].text
              )}
            >
              {fitness.digest}
            </span>
            <span
              className={cn(
                "shrink-0 text-sm font-medium",
                trendConfig[fitness.missRateTrend].text
              )}
            >
              {trendConfig[fitness.missRateTrend].arrow}
            </span>
          </div>
          <div
            className={cn(
              "mt-1 text-[10px] opacity-70",
              trendConfig[fitness.missRateTrend].text
            )}
          >
            {`${(fitness.missRate * 100).toFixed(0)}% miss rate`}
          </div>
        </div>
      ) : (
        <div
          data-testid="fitness-banner"
          className="rounded-sm border border-border/50 bg-[var(--surface)]/50 px-3 py-2 text-xs text-[var(--foreground)]/40"
        >
          Learning loop initializing — first metrics after 5 sessions
        </div>
      )}

      {/* Recent insights */}
      <div className="mt-2">
        {insights && insights.length > 0 ? (
          <ul className="space-y-1">
            {insights.slice(0, 5).map((insight) => (
              <li key={insight.id} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                <span className="truncate font-[family-name:var(--font-space-grotesk)] text-xs text-[var(--foreground)]/60">
                  {insight.content}
                </span>
              </li>
            ))}
          </ul>
        ) : insights !== undefined ? (
          <p className="text-xs text-[var(--foreground)]/40">No insights captured yet</p>
        ) : null}
      </div>
    </StealthCard>
  );
}
