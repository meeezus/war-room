"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StealthCard } from "./stealth-card";
import type { HealthCheck } from "@/lib/types";

interface StatusRibbonProps {
  pendingDiscoveries: number;
  criticalCount?: number;
  warningCount?: number;
  infoCount?: number;
  awarenessCount?: number;
  lastPatrol: { timestamp: string | null; discoveryCount: number };
  skillStats: { recentPatches: number; appliedPatches: number };
  councilSessions: number;
  recapCount: number;
  usageData: { quotaPercent: number; dailyCost: number } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isRecentPatrol(timestamp: string | null): boolean {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() < 10 * 60 * 1000;
}

function CardLabel({ romaji, english }: { romaji: string; english: string }) {
  return (
    <div>
      <p className="font-[family-name:var(--font-space-grotesk)] text-[10px] uppercase tracking-wider text-muted-foreground">
        {romaji}
      </p>
      <p className="font-[family-name:var(--font-space-grotesk)] text-[9px] tracking-wide text-muted-foreground/60">
        {english}
      </p>
    </div>
  );
}

function CardValue({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-[family-name:var(--font-jetbrains-mono)] text-lg font-medium text-foreground">
      {children}
    </p>
  );
}

function SituationCard({
  pendingDiscoveries,
  criticalCount = 0,
  warningCount = 0,
  infoCount = 0,
  awarenessCount = 0,
  lastPatrol,
}: Pick<StatusRibbonProps, "pendingDiscoveries" | "criticalCount" | "warningCount" | "infoCount" | "awarenessCount" | "lastPatrol">) {
  const recentPatrol = isRecentPatrol(lastPatrol.timestamp);
  return (
    <StealthCard hover={false} className="px-4 py-3 min-w-[200px] min-h-[110px] flex-shrink-0 flex flex-col justify-between">
      <CardLabel romaji="Dōjō Hōkoku" english="SitRep" />
      <CardValue>{pendingDiscoveries}</CardValue>
      <div className="flex gap-1.5 mt-1 flex-wrap">
        {criticalCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-[family-name:var(--font-jetbrains-mono)]">
            {criticalCount} critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-[family-name:var(--font-jetbrains-mono)]">
            {warningCount} warning
          </span>
        )}
        {infoCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-[family-name:var(--font-jetbrains-mono)]">
            {infoCount} info
          </span>
        )}
      </div>
      {awarenessCount > 0 && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-[family-name:var(--font-jetbrains-mono)]">
            {awarenessCount} awareness
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-1.5">
        {recentPatrol && (
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
        )}
        <p className="text-[10px] text-muted-foreground/70 font-[family-name:var(--font-jetbrains-mono)]">
          {lastPatrol.timestamp
            ? `Last patrol: ${timeAgo(lastPatrol.timestamp)} · ${lastPatrol.discoveryCount} pending`
            : "No patrols yet"}
        </p>
      </div>
      <Link
        href="/brief"
        className="text-xs text-blue-400 mt-1 block hover:text-blue-300"
      >
        View Brief →
      </Link>
    </StealthCard>
  );
}

function SkillsCard({ skillStats }: { skillStats: StatusRibbonProps["skillStats"] }) {
  return (
    <StealthCard hover={false} className="px-4 py-3 min-w-[200px] min-h-[110px] flex-shrink-0 flex flex-col justify-between">
      <CardLabel romaji="Ginō" english="Skills" />
      <CardValue>{skillStats.recentPatches}</CardValue>
      <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
        patches (30d)
      </p>
      <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
        {skillStats.appliedPatches} applied total
      </p>
    </StealthCard>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className="h-2 w-2 rounded-full inline-block"
      style={{
        backgroundColor: ok ? "#22c55e" : "#ef4444",
        boxShadow: `0 0 6px ${ok ? "#22c55e" : "#ef4444"}`,
      }}
    />
  );
}

function HealthCard() {
  const [health, setHealth] = useState<HealthCheck | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: HealthCheck) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  return (
    <Link href="/health" className="block">
      <StealthCard hover={false} className="px-4 py-3 min-w-[200px] min-h-[110px] flex-shrink-0 flex flex-col justify-between">
        <CardLabel romaji="Kenzen" english="Health" />
        {health ? (
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-2">
              <StatusDot ok={health.checks.supabase} />
              <span className="text-xs text-foreground/60 font-[family-name:var(--font-jetbrains-mono)]">
                Supabase
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot ok={health.checks.claude_cli} />
              <span className="text-xs text-foreground/60 font-[family-name:var(--font-jetbrains-mono)]">
                Claude
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot ok={health.checks.poller.alive} />
              <span className="text-xs text-foreground/60 font-[family-name:var(--font-jetbrains-mono)]">
                Poller
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] mt-1">
            Loading…
          </p>
        )}
      </StealthCard>
    </Link>
  );
}

function CouncilCard({ activeSessions }: { activeSessions: number }) {
  return (
    <Link href="/council" className="block">
      <StealthCard hover={false} className="px-4 py-3 min-w-[200px] min-h-[110px] flex-shrink-0 flex flex-col justify-between">
        <CardLabel romaji="Hyōjō" english="Council" />
        <CardValue>{activeSessions}</CardValue>
        <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
          active sessions
        </p>
      </StealthCard>
    </Link>
  );
}

function ProposalsCard() {
  return (
    <Link href="/proposals" className="block">
      <StealthCard hover={false} className="px-4 py-3 min-w-[200px] min-h-[110px] flex-shrink-0 flex flex-col justify-between">
        <CardLabel romaji="Teian" english="Proposals" />
        <CardValue>&rarr;</CardValue>
        <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
          Review proposals
        </p>
      </StealthCard>
    </Link>
  );
}

function RecapCard({ recapCount }: { recapCount: number }) {
  return (
    <Link href="/recaps" className="block">
      <StealthCard hover={false} className="px-4 py-3 min-w-[200px] min-h-[110px] flex-shrink-0 flex flex-col justify-between">
        <CardLabel romaji="Ouroboros" english="Recaps" />
        <CardValue>{recapCount}</CardValue>
        <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
          last 7 days
        </p>
      </StealthCard>
    </Link>
  );
}

function UsageCard({ usageData }: { usageData: StatusRibbonProps["usageData"] }) {
  return (
    <Link href="/usage" className="block">
      <StealthCard hover={false} className="px-4 py-3 min-w-[200px] min-h-[110px] flex-shrink-0 flex flex-col justify-between">
        <CardLabel romaji="Shiyō" english="Usage" />
        {usageData ? (
          <>
            <CardValue>{usageData.quotaPercent}%</CardValue>
            <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
              quota used
            </p>
            <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
              ${usageData.dailyCost.toFixed(2)} today
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] mt-1">
            No data
          </p>
        )}
      </StealthCard>
    </Link>
  );
}

function ChatCard() {
  return (
    <Link href="/chat" className="block">
      <StealthCard hover={false} className="px-4 py-3 min-w-[200px] min-h-[110px] flex-shrink-0 flex flex-col justify-between">
        <CardLabel romaji="Taiwa" english="Chat" />
        <div className="flex items-center gap-2">
          <img
            src="/avatars/makima.webp"
            alt="Makima"
            className="h-8 w-8 rounded-full object-cover"
          />
          <span className="text-sm text-muted-foreground">Makima</span>
        </div>
        <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
          Shoin Chat
        </p>
      </StealthCard>
    </Link>
  );
}

export function StatusRibbon({
  pendingDiscoveries,
  criticalCount,
  warningCount,
  infoCount,
  awarenessCount,
  lastPatrol,
  skillStats,
  councilSessions,
  recapCount,
  usageData,
}: StatusRibbonProps) {
  return (
    <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2">
      <ChatCard />
      <SituationCard
        pendingDiscoveries={pendingDiscoveries}
        criticalCount={criticalCount}
        warningCount={warningCount}
        infoCount={infoCount}
        awarenessCount={awarenessCount}
        lastPatrol={lastPatrol}
      />
      <SkillsCard skillStats={skillStats} />
      <HealthCard />
      <CouncilCard activeSessions={councilSessions} />
      <ProposalsCard />
      <RecapCard recapCount={recapCount} />
      <UsageCard usageData={usageData} />
    </div>
  );
}
