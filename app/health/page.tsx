"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/breadcrumb";
import type { HealthCheck } from "@/lib/types";

export default function HealthPage() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: HealthCheck) => {
        setHealth(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const allOk = health?.status === "ok";

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <Breadcrumb segments={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Health" },
        ]} className="mb-6" />

        <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground mb-2">
          System Health
        </h1>

        {loading ? (
          <p className="text-sm text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
            Checking services...
          </p>
        ) : error ? (
          <div className="rounded-sm border border-red-500/20 bg-red-500/5 p-6 text-center mt-4">
            <p className="text-sm text-red-400">Failed to reach health endpoint</p>
          </div>
        ) : health ? (
          <>
            {/* Overall status banner */}
            <div className={`rounded-sm border px-4 py-3 mb-6 ${allOk ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${allOk ? "bg-emerald-500" : "bg-red-500"}`}
                  style={{ boxShadow: `0 0 8px ${allOk ? "#22c55e" : "#ef4444"}` }} />
                <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold">
                  {allOk ? "All Systems Operational" : "Degraded Performance"}
                </span>
              </div>
            </div>

            {/* Service cards */}
            <div className="flex flex-col gap-3">
              {/* Supabase */}
              <ServiceCard
                name="Supabase"
                ok={health.checks.supabase}
                detail={health.checks.supabase ? "Connected" : "Unreachable"}
              />

              {/* Claude CLI */}
              <ServiceCard
                name="Claude CLI"
                ok={health.checks.claude_cli}
                detail={health.checks.claude_cli ? "Available" : "Not found or not responding"}
              />

              {/* Poller */}
              <ServiceCard
                name="Poller"
                ok={health.checks.poller.alive}
                detail={
                  health.checks.poller.alive
                    ? `Last heartbeat: ${health.checks.poller.last_heartbeat ? new Date(health.checks.poller.last_heartbeat).toLocaleString() : "Unknown"}`
                    : `Down — last heartbeat: ${health.checks.poller.last_heartbeat ? new Date(health.checks.poller.last_heartbeat).toLocaleString() : "Never"}`
                }
              />
            </div>

            {/* Timestamp */}
            <p className="text-[10px] text-muted-foreground/75 mt-6 font-[family-name:var(--font-jetbrains-mono)]">
              Uptime: {Math.round(health.uptime_ms / 1000)}s · Checked at {new Date().toLocaleString()}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ServiceCard({ name, ok, detail }: { name: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-sm border border-border bg-card backdrop-blur-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={`h-2 w-2 rounded-full flex-shrink-0 ${ok ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ boxShadow: `0 0 6px ${ok ? "#22c55e" : "#ef4444"}` }}
        />
        <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-foreground flex-1">
          {name}
        </span>
        <span className={`text-xs font-[family-name:var(--font-jetbrains-mono)] ${ok ? "text-emerald-400" : "text-red-400"}`}>
          {ok ? "Operational" : "Down"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 ml-5 font-[family-name:var(--font-jetbrains-mono)]">
        {detail}
      </p>
    </div>
  );
}
