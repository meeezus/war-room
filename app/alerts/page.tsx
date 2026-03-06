"use client";

import { useEffect, useState } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { StealthCard } from "@/components/stealth-card";
import { cn } from "@/lib/utils";

interface Failure {
  id: string;
  title: string;
  agent: string;
  rootCause: string | null;
  fixApproach: string | null;
}

interface EngineStatus {
  health: "nominal" | "degraded" | "down";
  failures: Failure[];
}

export default function AlertsPage() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/engine-status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/50 px-6 py-4">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-[18px] font-semibold tracking-tight">
            Alert Rules
          </h1>
          <p className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
            monitor · escalate · automate
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-4">

            {/* Current Failures */}
            <StealthCard>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[12px] font-semibold uppercase tracking-[1px] text-muted-foreground/70">
                    Recent Failures (24h)
                  </span>
                  {!loading && status && (
                    <span
                      className={cn(
                        "font-[family-name:var(--font-jetbrains-mono)] text-[11px] rounded px-2 py-0.5",
                        status.failures.length === 0
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      )}
                    >
                      {status.failures.length} failure{status.failures.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {loading && (
                  <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/50">
                    loading...
                  </p>
                )}

                {!loading && status && status.failures.length === 0 && (
                  <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-green-400/70">
                    No failures in the last 24 hours.
                  </p>
                )}

                {!loading && status && status.failures.length > 0 && (
                  <div className="space-y-2">
                    {status.failures.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-sm border border-border/50 bg-red-500/[0.03] p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-[family-name:var(--font-space-grotesk)] text-[13px] text-foreground">
                            {f.title}
                          </span>
                          <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/60">
                            {f.agent}
                          </span>
                        </div>
                        {f.rootCause && (
                          <p className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/70">
                            Root cause: {f.rootCause}
                          </p>
                        )}
                        {f.fixApproach && (
                          <p className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-blue-400/70">
                            Fix: {f.fixApproach}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </StealthCard>

            {/* Coming Soon */}
            <StealthCard>
              <div className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] rounded bg-amber-500/10 px-2 py-0.5 text-amber-400">
                    coming soon
                  </span>
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[12px] font-semibold uppercase tracking-[1px] text-muted-foreground/70">
                    Alert Configuration
                  </span>
                </div>
                <p className="mb-3 font-[family-name:var(--font-space-grotesk)] text-[13px] text-muted-foreground">
                  Configurable alert rules and notification routing are planned for a future sprint.
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Custom thresholds", desc: "Set failure rate, latency, or cost limits per agent or globally" },
                    { label: "Notification channels", desc: "Route alerts to Discord, Slack, email, or webhook" },
                    { label: "Escalation rules", desc: "Auto-escalate unacknowledged alerts after a configurable timeout" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex gap-3 rounded-sm border border-border/40 p-3 opacity-60"
                    >
                      <span className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/50">
                        —
                      </span>
                      <div>
                        <span className="font-[family-name:var(--font-space-grotesk)] text-[12px] font-medium text-foreground/70">
                          {item.label}
                        </span>
                        <p className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/50">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </StealthCard>

          </div>
        </div>
      </main>
    </div>
  );
}
