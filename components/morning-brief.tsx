"use client";

import { useState } from "react";
import Link from "next/link";
import { StealthCard } from "@/components/stealth-card";
import type { EngineStatus } from "@/lib/types";

const AGENT_COLORS: Record<string, string> = {
  ed: "#3b82f6",
  light: "#a855f7",
  armin: "#22c55e",
  toji: "#f59e0b",
  makima: "#ef4444",
  major: "#6b7280",
};
function agentColor(id: string) {
  return AGENT_COLORS[id.toLowerCase()] ?? "#888";
}

function HealthBadge({
  health,
  avgCycleMs,
}: {
  health: EngineStatus["health"];
  avgCycleMs: number | null;
}) {
  const config = {
    nominal: { bg: "bg-green-500/15", text: "text-green-400", label: "Nominal" },
    degraded: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Degraded" },
    down: { bg: "bg-red-500/15", text: "text-red-400", label: "Down" },
  }[health];

  return (
    <div className="flex items-center gap-3">
      <span
        className={`${config.bg} ${config.text} rounded-full px-3 py-1 text-xs font-medium font-[family-name:var(--font-jetbrains-mono)]`}
      >
        {config.label}
      </span>
      {avgCycleMs !== null && (
        <span className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
          {(avgCycleMs / 1000).toFixed(0)}s avg cycle
        </span>
      )}
    </div>
  );
}

function FailureCard({
  failure,
}: {
  failure: EngineStatus["failures"][number];
}) {
  return (
    <div className="border-l-2 border-red-500/60 pl-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: agentColor(failure.agent) }}
        />
        <Link
          href={`/missions/${failure.id}`}
          className="text-sm text-foreground hover:text-foreground/80 font-[family-name:var(--font-space-grotesk)] truncate"
        >
          {failure.title}
        </Link>
        <span className="text-[10px] text-muted-foreground/60 font-[family-name:var(--font-jetbrains-mono)] flex-shrink-0">
          {failure.agent}
        </span>
      </div>
      {failure.rootCause && (
        <p className="mt-1 text-xs text-red-400/80 font-[family-name:var(--font-jetbrains-mono)]">
          {failure.rootCause}
        </p>
      )}
      {failure.fixApproach && (
        <p className="mt-0.5 text-xs text-muted-foreground/70 font-[family-name:var(--font-jetbrains-mono)]">
          Fix: {failure.fixApproach}
        </p>
      )}
    </div>
  );
}

function WinRow({ win }: { win: EngineStatus["wins"][number] }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-green-400 text-xs flex-shrink-0">&#10003;</span>
      <span
        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: agentColor(win.agent) }}
      />
      <span className="text-xs text-foreground/80 font-[family-name:var(--font-jetbrains-mono)] truncate">
        {win.title}
      </span>
      <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
        {win.agent}
      </span>
    </div>
  );
}

function AuthorityRow({
  domain,
  data,
}: {
  domain: string;
  data: { tier: string; totalMissions: number; successful: number; successRate: number };
}) {
  const tierConfig =
    data.tier === "auto-approve"
      ? { bg: "bg-green-500/15", text: "text-green-400", label: "Auto" }
      : { bg: "bg-amber-500/15", text: "text-amber-400", label: "Propose" };

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-foreground/80 font-[family-name:var(--font-space-grotesk)] w-24 capitalize truncate">
        {domain}
      </span>
      <span
        className={`${tierConfig.bg} ${tierConfig.text} rounded px-1.5 py-0.5 text-[10px] font-[family-name:var(--font-jetbrains-mono)]`}
      >
        {tierConfig.label}
      </span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(data.successRate * 100, 100)}%`,
            backgroundColor:
              data.successRate >= 0.8 ? "#22c55e" : data.successRate >= 0.5 ? "#f59e0b" : "#ef4444",
          }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] w-16 text-right">
        {data.successful}/{data.totalMissions}
      </span>
    </div>
  );
}

export function MorningBrief({ engineStatus }: { engineStatus: EngineStatus }) {
  const needsAttention =
    engineStatus.failures.length > 0 ||
    engineStatus.stalledObjectives.length > 0 ||
    engineStatus.health === "down";
  const [expanded, setExpanded] = useState(needsAttention);
  const [showAllWins, setShowAllWins] = useState(false);
  const [showStalled, setShowStalled] = useState(false);
  const [showAutoApproved, setShowAutoApproved] = useState(false);

  const displayedWins = showAllWins
    ? engineStatus.wins
    : engineStatus.wins.slice(0, 5);
  const domainEntries = Object.entries(engineStatus.authority.domains);

  return (
    <StealthCard hover={false} className="mb-2 md:mb-3">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Morning Brief
          </span>
          <HealthBadge
            health={engineStatus.health}
            avgCycleMs={engineStatus.avgCycleMs}
          />
          {engineStatus.failures.length > 0 && (
            <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400 font-[family-name:var(--font-jetbrains-mono)]">
              {engineStatus.failures.length} failed
            </span>
          )}
          {engineStatus.pendingProposals > 0 && (
            <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400 font-[family-name:var(--font-jetbrains-mono)]">
              {engineStatus.pendingProposals} pending
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground/50">
          {expanded ? "\u25B2" : "\u25BC"}
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-4">
          {/* Failures */}
          {engineStatus.failures.length > 0 && (
            <div>
              <h3 className="font-[family-name:var(--font-space-grotesk)] text-[10px] uppercase tracking-wider text-red-400/80 mb-2">
                Failures (24h)
              </h3>
              <div className="space-y-2">
                {engineStatus.failures.map((f) => (
                  <FailureCard key={f.id} failure={f} />
                ))}
              </div>
            </div>
          )}

          {/* Attention */}
          {(engineStatus.stalledObjectives.length > 0 ||
            engineStatus.autoApproved.length > 0 ||
            engineStatus.pendingProposals > 0) && (
            <div>
              <h3 className="font-[family-name:var(--font-space-grotesk)] text-[10px] uppercase tracking-wider text-amber-400/80 mb-2">
                Attention
              </h3>
              <div className="space-y-2">
                {engineStatus.stalledObjectives.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowStalled(!showStalled)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-[family-name:var(--font-jetbrains-mono)] flex items-center gap-1"
                    >
                      <span className="text-[10px] text-amber-400/50">{showStalled ? "\u25BC" : "\u25B6"}</span>
                      {engineStatus.stalledObjectives.length} stalled objective
                      {engineStatus.stalledObjectives.length !== 1 ? "s" : ""} (48h no activity)
                    </button>
                    {showStalled && (
                      <div className="mt-1 ml-3 space-y-0.5">
                        {engineStatus.stalledObjectives.map((o) => (
                          <Link
                            key={o.id}
                            href={`/objectives/${o.id}`}
                            className="block text-xs text-foreground/70 hover:text-foreground font-[family-name:var(--font-jetbrains-mono)] truncate"
                          >
                            {o.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {engineStatus.autoApproved.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowAutoApproved(!showAutoApproved)}
                      className="text-xs text-muted-foreground hover:text-foreground/80 font-[family-name:var(--font-jetbrains-mono)] flex items-center gap-1"
                    >
                      <span className="text-[10px] text-muted-foreground/50">{showAutoApproved ? "\u25BC" : "\u25B6"}</span>
                      {engineStatus.autoApproved.length} auto-approved (24h)
                    </button>
                    {showAutoApproved && (
                      <div className="mt-1 ml-3 space-y-0.5">
                        {engineStatus.autoApproved.map((p) => (
                          <span
                            key={p.id}
                            className="block text-xs text-foreground/60 font-[family-name:var(--font-jetbrains-mono)] truncate"
                          >
                            {p.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {engineStatus.pendingProposals > 0 && (
                  <Link
                    href="/proposals"
                    className="text-xs text-blue-400 hover:text-blue-300 font-[family-name:var(--font-jetbrains-mono)] flex items-center gap-1"
                  >
                    <span className="text-[10px] text-blue-400/50">{"\u25B6"}</span>
                    {engineStatus.pendingProposals} pending proposal
                    {engineStatus.pendingProposals !== 1 ? "s" : ""}
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Wins */}
          {engineStatus.wins.length > 0 && (
            <div>
              <h3 className="font-[family-name:var(--font-space-grotesk)] text-[10px] uppercase tracking-wider text-green-400/80 mb-2">
                Wins (24h)
              </h3>
              <div className="space-y-0.5">
                {displayedWins.map((w) => (
                  <WinRow key={w.id} win={w} />
                ))}
              </div>
              {engineStatus.wins.length > 5 && !showAllWins && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllWins(true);
                  }}
                  className="mt-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]"
                >
                  + {engineStatus.wins.length - 5} more
                </button>
              )}
            </div>
          )}

          {/* Authority */}
          {engineStatus.authority.enabled && domainEntries.length > 0 && (
            <div>
              <h3 className="font-[family-name:var(--font-space-grotesk)] text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-2">
                Authority (threshold: {engineStatus.authority.threshold}%)
              </h3>
              <div>
                {domainEntries.map(([domain, data]) => (
                  <AuthorityRow
                    key={domain}
                    domain={domain}
                    data={data as { tier: string; totalMissions: number; successful: number; successRate: number }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </StealthCard>
  );
}
