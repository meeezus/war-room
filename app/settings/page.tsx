"use client";

import { useEffect, useState } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { StealthCard } from "@/components/stealth-card";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface CapGate {
  id: string;
  max_cost_per_day: number;
  max_time_per_mission: string;
  max_concurrent_missions: number;
  auto_approve_cost_limit: number;
  auto_approve_risk: string;
}

function formatCurrency(val: number) {
  return `$${val.toFixed(2)}`;
}

function formatInterval(val: string) {
  // Parse postgres interval like "00:30:00" or "30 minutes"
  if (!val) return val;
  const match = val.match(/(\d+):(\d+):(\d+)/);
  if (match) {
    const h = parseInt(match[1]);
    const m = parseInt(match[2]);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
  return val;
}

export default function SettingsPage() {
  const [capGate, setCapGate] = useState<CapGate | null>(null);
  const [capLoading, setCapLoading] = useState(true);
  const [nodeEnv, setNodeEnv] = useState<string>("—");

  useEffect(() => {
    if (!supabase) {
      setCapLoading(false);
      return;
    }
    supabase
      .from("cap_gates")
      .select("*")
      .limit(1)
      .single()
      .then(({ data }: { data: unknown }) => {
        if (data) setCapGate(data as CapGate);
        setCapLoading(false);
      }, () => setCapLoading(false));
  }, []);

  useEffect(() => {
    setNodeEnv(process.env.NODE_ENV ?? "—");
  }, []);

  const capRows = capGate
    ? [
        { label: "Max Cost / Day", value: formatCurrency(capGate.max_cost_per_day) },
        { label: "Max Time / Mission", value: formatInterval(capGate.max_time_per_mission) },
        { label: "Max Concurrent", value: String(capGate.max_concurrent_missions) },
        { label: "Auto-Approve Cost Limit", value: formatCurrency(capGate.auto_approve_cost_limit) },
        { label: "Auto-Approve Risk Level", value: capGate.auto_approve_risk },
      ]
    : [];

  const infoRows = [
    { label: "Environment", value: nodeEnv },
    { label: "Next.js", value: "15.x" },
    { label: "Runtime", value: "Edge / Node.js" },
  ];

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/50 px-6 py-4">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-[18px] font-semibold tracking-tight">
            System Settings
          </h1>
          <p className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
            read-only · configure via database
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl space-y-4">

            {/* Cap Gates */}
            <StealthCard>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[12px] font-semibold uppercase tracking-[1px] text-muted-foreground/70">
                    Cap Gates
                  </span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] rounded bg-muted px-2 py-0.5 text-muted-foreground/60">
                    read-only
                  </span>
                </div>

                {capLoading && (
                  <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/50">
                    loading...
                  </p>
                )}

                {!capLoading && !capGate && (
                  <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/50">
                    No cap gate configuration found.
                  </p>
                )}

                {!capLoading && capGate && (
                  <div className="divide-y divide-border/40">
                    {capRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between py-2.5"
                      >
                        <span className="font-[family-name:var(--font-space-grotesk)] text-[12px] text-muted-foreground">
                          {row.label}
                        </span>
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] text-foreground">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </StealthCard>

            {/* System Info */}
            <StealthCard>
              <div className="p-4">
                <div className="mb-3">
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[12px] font-semibold uppercase tracking-[1px] text-muted-foreground/70">
                    System Info
                  </span>
                </div>
                <div className="divide-y divide-border/40">
                  {infoRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between py-2.5"
                    >
                      <span className="font-[family-name:var(--font-space-grotesk)] text-[12px] text-muted-foreground">
                        {row.label}
                      </span>
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] text-foreground">
                        {row.value}
                      </span>
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
