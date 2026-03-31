"use client";

import type { ParsedBead } from "@/lib/types";
import { StealthCard } from "@/components/stealth-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanWaveGraphProps {
  beads: ParsedBead[];
  missionStatuses?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_DOT_COLOR: Record<string, string> = {
  completed: "bg-green-500",
  running: "bg-amber-500 animate-pulse",
  queued: "bg-gray-500",
  failed: "bg-red-500",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlanWaveGraph({ beads, missionStatuses }: PlanWaveGraphProps) {
  if (beads.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground/50">
          No beads to display
        </p>
      </div>
    );
  }

  // Group beads by wave_index
  const waveMap = new Map<number, ParsedBead[]>();
  for (const bead of beads) {
    const list = waveMap.get(bead.wave_index) ?? [];
    list.push(bead);
    waveMap.set(bead.wave_index, list);
  }

  const waves = Array.from(waveMap.entries()).sort(([a], [b]) => a - b);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0 py-2">
        {waves.map(([waveIdx, waveBeads], i) => (
          <div key={waveIdx} className="flex items-start">
            {/* Wave column */}
            <div data-wave={waveIdx} className="min-w-[200px] flex-shrink-0">
              <div className="mb-2 text-center">
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[2px] text-muted-foreground/60">
                  Wave {waveIdx}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {waveBeads.map((bead) => {
                  const status = missionStatuses?.[bead.id];
                  const dotColor =
                    STATUS_DOT_COLOR[status ?? ""] ?? "bg-gray-500";

                  return (
                    <StealthCard
                      key={bead.id}
                      className="relative min-h-[44px] p-3"
                      hover={false}
                    >
                      {/* Status dot */}
                      <span
                        data-status-dot
                        className={`absolute right-3 top-3 size-2 rounded-full ${dotColor}`}
                      />

                      {/* Bead title */}
                      <p className="truncate pr-5 text-xs font-medium text-foreground">
                        {bead.title}
                      </p>

                      {/* Tags */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="rounded bg-blue-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-blue-400">
                          {bead.repo}
                        </span>
                        <span className="rounded bg-purple-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-purple-400">
                          {bead.size}
                        </span>
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-amber-400">
                          {bead.domain}
                        </span>
                      </div>
                    </StealthCard>
                  );
                })}
              </div>
            </div>

            {/* Arrow between waves */}
            {i < waves.length - 1 && (
              <div
                data-wave-arrow
                className="flex min-w-[32px] items-center justify-center pt-10 text-muted-foreground/30"
              >
                <span className="text-lg">&#8594;</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
