"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SidebarNav } from "@/components/sidebar-nav";
import { StealthCard } from "@/components/stealth-card";
import { PlanWaveGraph } from "@/components/plan-wave-graph";
import { PlanChat } from "@/components/plan-chat";
import { useRealtimePlanMissions } from "@/lib/realtime";
import { getPlanMissions } from "@/lib/queries";
import type { Plan, Mission } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  brainstorming: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  analyzing: "bg-purple-500/15 text-purple-400 border-purple-500/30 animate-pulse",
  reviewing: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  approved: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  running: "bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground/40";
  if (score <= 4) return "text-green-400";
  if (score <= 6) return "text-blue-400";
  if (score <= 8) return "text-amber-400";
  return "text-red-400";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlanDetailPage() {
  const params = useParams();
  const planId = params?.id as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [initialMissions, setInitialMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [approving, setApproving] = useState(false);
  const [brainstorming, setBrainstorming] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [iterating, setIterating] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch(`/api/plans/${planId}`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan ?? data);
      }
      // Fetch missions for this plan
      const missions = await getPlanMissions(planId);
      setInitialMissions(missions as Mission[]);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  // Initial fetch
  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Auto-refresh when brainstorming (3s), analyzing (3s), or running (5s)
  useEffect(() => {
    if (plan?.status === "brainstorming" || plan?.status === "analyzing") {
      intervalRef.current = setInterval(fetchPlan, 3000);
    } else if (plan?.status === "running") {
      intervalRef.current = setInterval(fetchPlan, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [plan?.status, fetchPlan]);

  // Realtime mission updates
  const realtimeMissions = useRealtimePlanMissions(planId, initialMissions);

  // Build bead ID -> mission status map for the wave graph
  const missionStatuses: Record<string, string> = {};
  for (const mission of realtimeMissions) {
    const beadMatch = mission.title?.match(/^(BEAD-\d+)/);
    if (beadMatch) {
      missionStatuses[beadMatch[1]] = mission.status;
    }
  }

  // Progress tracking
  const totalBeads = plan?.parsed_beads?.length ?? 0;
  const completedBeads = Object.values(missionStatuses).filter(
    (s) => s === "completed" || s === "deployed",
  ).length;
  const failedBeads = Object.values(missionStatuses).filter(
    (s) => s === "failed",
  ).length;

  async function handleApprove() {
    setApproving(true);
    try {
      await fetch(`/api/plans/${planId}/approve`, { method: "POST" });
      await fetchPlan();
    } finally {
      setApproving(false);
    }
  }

  async function handleBrainstorm() {
    setBrainstorming(true);
    try {
      await fetch(`/api/plans/${planId}/brainstorm`, { method: "POST" });
      await fetchPlan();
    } finally {
      setBrainstorming(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <SidebarNav />
        <div className="flex flex-1 items-center justify-center">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground">
            Loading plan...
          </p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex h-screen bg-background">
        <SidebarNav />
        <div className="flex flex-1 items-center justify-center">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground/50">
            Plan not found
          </p>
        </div>
      </div>
    );
  }

  const beadCount = plan.parsed_beads?.length ?? 0;
  const statusClass = STATUS_COLORS[plan.status] ?? STATUS_COLORS.draft;
  const isBrainstorming = plan.status === "brainstorming";
  const isAnalyzing = plan.status === "analyzing";
  const isRunning = plan.status === "running";
  const showApprove = plan.status === "reviewing" || plan.status === "approved";

  // Detect mode from raw_markdown metadata (if brainstorm has run)
  const modeMatch = plan.raw_markdown?.match(/\*\*Mode:\*\*\s*(Startup|Builder)/i);
  const detectedMode = modeMatch ? modeMatch[1].toLowerCase() as 'startup' | 'builder' : null;

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex h-10 flex-shrink-0 items-center gap-2 sm:gap-4 border-b border-border/50 pl-14 pr-4 sm:px-5 lg:pl-5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
          <Link href="/plans" className="shrink-0 transition-colors hover:text-foreground">
            <span className="hidden sm:inline">Tenshu / </span>Plans
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="truncate text-foreground/60">{plan.title}</span>
        </div>

        {/* Content + Chat */}
        <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="mx-auto max-w-4xl space-y-4">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-foreground">
                {plan.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded border px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}
                >
                  {plan.status}
                </span>
                {detectedMode && (
                  <span
                    className={`rounded border px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-semibold uppercase tracking-wide ${
                      detectedMode === 'startup'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    }`}
                  >
                    {detectedMode}
                  </span>
                )}
                {plan.flywheel_score !== null && (
                  <span
                    className={`font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tabular-nums ${scoreColor(plan.flywheel_score)}`}
                  >
                    {plan.flywheel_score}
                  </span>
                )}
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/60">
                  {beadCount} {beadCount === 1 ? "bead" : "beads"} &middot;{" "}
                  {plan.wave_count} {plan.wave_count === 1 ? "wave" : "waves"}
                </span>
              </div>
            </div>

            {/* Completion Banner */}
            {plan.status === "completed" && (
              <div className="rounded-sm border border-green-500/20 bg-green-500/5 p-4">
                <div className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-green-500 mb-1">
                  Plan Complete
                </div>
                <div className="text-xs text-muted-foreground">
                  {completedBeads}/{totalBeads} beads succeeded
                  {failedBeads > 0 && ` \u00b7 ${failedBeads} failed`}
                </div>
              </div>
            )}

            {/* Execution Progress */}
            {totalBeads > 0 && Object.keys(missionStatuses).length > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] mb-1">
                  <span>Execution Progress</span>
                  <span>{completedBeads} / {totalBeads} beads</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${totalBeads > 0 ? (completedBeads / totalBeads) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Brainstorming State */}
            {isBrainstorming && (
              <div className="rounded-sm border border-purple-500/20 bg-purple-500/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="size-2 animate-pulse rounded-full bg-purple-400" />
                  <div>
                    <div className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-purple-400">
                      Brainstorming...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Expanding idea into structured beads. This takes 10-20 seconds.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Outcome Summary */}
            <StealthCard className="p-4" hover={false}>
              <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-[13px] font-semibold uppercase tracking-[1px] text-muted-foreground">
                What This Achieves
              </h2>
              {beadCount > 0 ? (
                <ul className="space-y-1.5">
                  {(plan.parsed_beads ?? []).map((bead) => (
                    <li
                      key={bead.id}
                      className="flex items-start gap-2 text-sm text-foreground/80"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-500" />
                      {bead.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground/50">
                  No beads parsed yet
                </p>
              )}
            </StealthCard>

            {/* Analysis Card */}
            <StealthCard className="p-4" hover={false}>
              {plan.analysis ? (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="font-[family-name:var(--font-space-grotesk)] text-[13px] font-semibold uppercase tracking-[1px] text-muted-foreground">
                      Analysis
                    </h2>
                    <span className="rounded bg-purple-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-purple-400">
                      {plan.analysis.depth}
                    </span>
                  </div>

                  {plan.analysis.pushback.length > 0 && (
                    <div className="mb-3">
                      <h3 className="mb-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-wider text-amber-400">
                        Pushback
                      </h3>
                      <ul className="space-y-1">
                        {plan.analysis.pushback.map((item, i) => (
                          <li key={i} className="text-sm text-amber-300/80">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {plan.analysis.alternatives.length > 0 && (
                    <div className="mb-3">
                      <h3 className="mb-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-wider text-blue-400">
                        Alternatives
                      </h3>
                      <ul className="space-y-1">
                        {plan.analysis.alternatives.map((item, i) => (
                          <li key={i} className="text-sm text-blue-300/80">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {plan.analysis.blind_spots.length > 0 && (
                    <div className="mb-3">
                      <h3 className="mb-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-wider text-red-400">
                        Blind Spots
                      </h3>
                      <ul className="space-y-1">
                        {plan.analysis.blind_spots.map((item, i) => (
                          <li key={i} className="text-sm text-red-300/80">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {plan.analysis.recommendation && (
                    <div>
                      <h3 className="mb-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-wider text-muted-foreground">
                        Recommendation
                      </h3>
                      <p className="text-sm text-foreground/80">
                        {plan.analysis.recommendation}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground/50">
                  {plan.flywheel_score !== null && plan.flywheel_score <= 4
                    ? "Low stakes \u2014 no analysis needed"
                    : "Analysis pending"}
                </p>
              )}
            </StealthCard>

            {/* Wave Graph */}
            <div>
              <h2 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-[13px] font-semibold uppercase tracking-[1px] text-muted-foreground">
                Wave Graph
              </h2>
              <PlanWaveGraph beads={plan.parsed_beads ?? []} missionStatuses={missionStatuses} />
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
              {isBrainstorming && (
                <button
                  disabled
                  className="rounded-sm bg-purple-500/15 px-5 py-2 font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-purple-400 opacity-60 animate-pulse"
                >
                  Brainstorming...
                </button>
              )}

              {isAnalyzing && (
                <button
                  disabled
                  className="rounded-sm bg-purple-500/15 px-5 py-2 font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-purple-400 opacity-60"
                >
                  Analyzing...
                </button>
              )}

              {showApprove && !isRunning && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="rounded-sm bg-emerald-500 px-5 py-2 font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-background transition-colors hover:bg-emerald-400 disabled:opacity-50"
                >
                  {approving ? "Approving..." : "Approve & Execute"}
                </button>
              )}

              {detectedMode && !isBrainstorming && !isRunning && plan.status !== "completed" && (
                <button
                  onClick={handleBrainstorm}
                  disabled={brainstorming}
                  className="rounded-sm border border-purple-500/30 px-4 py-2 font-[family-name:var(--font-space-grotesk)] text-sm text-purple-400 transition-colors hover:bg-purple-500/10 disabled:opacity-50"
                >
                  {brainstorming ? "Re-brainstorming..." : "Re-brainstorm"}
                </button>
              )}

              {plan.status === "reviewing" && (
                <button
                  onClick={() => setShowFeedback(true)}
                  className="rounded-sm border border-border px-4 py-2 font-[family-name:var(--font-space-grotesk)] text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Iterate
                </button>
              )}

              <button
                disabled
                className="rounded-sm border border-border px-4 py-2 font-[family-name:var(--font-space-grotesk)] text-sm text-muted-foreground opacity-40"
              >
                Edit
              </button>

              <button
                onClick={() => setShowRaw(!showRaw)}
                className="rounded-sm border border-border px-4 py-2 font-[family-name:var(--font-space-grotesk)] text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                View Raw Plan
              </button>
            </div>

            {/* Iterate Feedback Area */}
            {showFeedback && (
              <div className="mt-3">
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Add your feedback... what should change? What's missing?"
                  className="w-full h-24 p-3 rounded-sm border border-border/50 bg-card text-sm text-foreground font-[family-name:var(--font-space-grotesk)] placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/50"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={async () => {
                      setIterating(true);
                      try {
                        const res = await fetch(`/api/plans/${plan.id}/iterate`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ feedback }),
                        });
                        if (res.ok) {
                          setFeedback("");
                          setShowFeedback(false);
                          fetchPlan();
                        }
                      } finally {
                        setIterating(false);
                      }
                    }}
                    disabled={!feedback.trim() || iterating}
                    className="px-4 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium font-[family-name:var(--font-space-grotesk)] disabled:opacity-40"
                  >
                    {iterating ? "Iterating..." : "Submit Feedback"}
                  </button>
                  <button
                    onClick={() => {
                      setShowFeedback(false);
                      setFeedback("");
                    }}
                    className="px-4 py-2 rounded-sm text-sm text-muted-foreground font-[family-name:var(--font-space-grotesk)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Raw Markdown (collapsible) */}
            {showRaw && (
              <StealthCard className="p-4" hover={false}>
                <pre className="overflow-x-auto whitespace-pre-wrap font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground">
                  {plan.raw_markdown}
                </pre>
              </StealthCard>
            )}
          </div>
        </div>

        {/* Desktop: Chat side panel */}
        <div className="w-[350px] border-l border-border/50 flex-shrink-0 hidden lg:flex flex-col">
          <div className="px-3 py-2 border-b border-border/50">
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-[family-name:var(--font-space-grotesk)]">
              Plan Chat
            </span>
          </div>
          <PlanChat
            planId={plan.id}
            initialHistory={plan.chat_history || []}
            onPlanUpdated={fetchPlan}
          />
        </div>
        </div>

        {/* Mobile: Collapsible chat at bottom */}
        <div className="lg:hidden border-t border-border/50">
          <button
            onClick={() => setShowChat(!showChat)}
            className="w-full p-2 text-center text-sm text-muted-foreground font-[family-name:var(--font-space-grotesk)] hover:text-foreground transition-colors"
          >
            {showChat ? "\u25BE Hide Chat" : "\u25B8 Open Chat"}
          </button>
          {showChat && (
            <div className="h-[400px]">
              <PlanChat
                planId={plan.id}
                initialHistory={plan.chat_history || []}
                onPlanUpdated={fetchPlan}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
