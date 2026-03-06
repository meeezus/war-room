# Tenshu v2 Ops Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild Tenshu as a pure ops dashboard (Mission Control style) by stripping human-directed features (objectives, council, chat) and adding clean stat cards, organized navigation, and persistent event rail.

**Architecture:** Replace current dashboard layout (daimyo sidebar + objectives overview + morning brief) with: left sidebar nav (organized by verb), main content (stat cards + panels), right event rail (always visible), bottom action bar. Keep existing APIs and data sources.

**Tech Stack:** Next.js 14, React, Tailwind CSS, Supabase, existing `/api/engine-status` endpoint

**Reference Mockup:** `~/.agent/diagrams/tenshu-v2-mockup.html`

---

## Sprint Overview

| Sprint | Tasks | Parallel Group | Focus |
|--------|-------|----------------|-------|
| S1 | T1-T4 | Group A (all parallel) | New components |
| S2 | T5 | Sequential | Dashboard rebuild |
| S3 | T6-T7 | Group B (parallel) | Nav cleanup |

---

## Sprint 1: New Components

### Task S1-T1: Sidebar Navigation Component

**Model:** sonnet

**Files:**
- Create: `components/sidebar-nav.tsx`

**Context:**
- Mission Control-style organized nav with sections: Command, Observe, System
- Daimyo agents list at bottom (without personalities, just status dots)
- Active route highlighting

**Implementation:**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "Command",
    items: [
      { label: "Overview", href: "/dashboard", icon: "◉" },
      { label: "Missions", href: "/missions", icon: "▸" },
    ],
  },
  {
    title: "Observe",
    items: [
      { label: "Events", href: "/events", icon: "≡" },
      { label: "Discoveries", href: "/discoveries", icon: "△" },
      { label: "Recaps", href: "/recaps", icon: "◬" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Health", href: "/health", icon: "♡" },
      { label: "Usage", href: "/usage", icon: "⟡" },
    ],
  },
];

interface AgentDot {
  name: string;
  color: string;
  status: "idle" | "active" | "offline";
}

interface SidebarNavProps {
  agents?: AgentDot[];
}

export function SidebarNav({ agents = [] }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-[200px] flex-col border-r border-border/50 bg-surface">
      {/* Brand */}
      <div className="border-b border-border/50 px-4 py-4">
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-[15px] font-bold tracking-tight">
          Tenshu
        </h1>
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
          v2.0 — Shogunate
        </span>
      </div>

      {/* Nav Sections */}
      <div className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => (
          <div key={section.title} className="mb-2">
            <div className="px-4 py-2 font-[family-name:var(--font-space-grotesk)] text-[9px] font-semibold uppercase tracking-[1.5px] text-muted-foreground/60">
              {section.title}
            </div>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 border-l-2 border-transparent px-4 py-[7px] text-[13px] text-muted-foreground transition-all hover:bg-foreground/[0.03] hover:text-foreground",
                    isActive && "border-l-blue-500 bg-foreground/[0.05] text-foreground"
                  )}
                >
                  <span className="w-4 text-center text-sm opacity-60">{item.icon}</span>
                  {item.label}
                  {item.badge && (
                    <span className="ml-auto rounded-lg bg-red-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-red-400">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Agents at bottom */}
      {agents.length > 0 && (
        <div className="border-t border-border/50 px-4 py-3">
          <div className="mb-2 font-[family-name:var(--font-space-grotesk)] text-[9px] font-semibold uppercase tracking-[1.5px] text-muted-foreground/60">
            Agents
          </div>
          <div className="space-y-1">
            {agents.map((agent) => (
              <div
                key={agent.name}
                className="flex items-center gap-2 py-1 text-[12px] text-muted-foreground"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: agent.color }}
                />
                {agent.name}
                <span className="ml-auto font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-muted-foreground/50">
                  {agent.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
```

**Verification:**
- Import in a test page and verify rendering
- Check active state highlighting works
- Verify responsive behavior (this is desktop-only sidebar)

---

### Task S1-T2: Stat Card Component

**Model:** sonnet

**Files:**
- Create: `components/stat-card.tsx`

**Context:**
- Generic stat card with accent bar, value, label, sub-text
- Color variants for health status (green/amber/red)
- Mission Control style: clean, minimal, monospace numbers

**Implementation:**

```tsx
import { cn } from "@/lib/utils";

type StatVariant = "default" | "success" | "warning" | "danger";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: StatVariant;
  className?: string;
}

const variantStyles: Record<StatVariant, { accent: string; value: string }> = {
  default: { accent: "bg-blue-500", value: "text-foreground" },
  success: { accent: "bg-green-500", value: "text-green-500" },
  warning: { accent: "bg-amber-500", value: "text-amber-500" },
  danger: { accent: "bg-red-500", value: "text-red-500" },
};

export function StatCard({ label, value, subtext, variant = "default", className }: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-surface p-4 transition-colors hover:border-border",
        className
      )}
    >
      {/* Accent bar */}
      <div className={cn("absolute left-0 right-0 top-0 h-0.5", styles.accent)} />

      <div className="mb-2 text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-[family-name:var(--font-jetbrains-mono)] text-[28px] font-semibold leading-none",
          styles.value
        )}
      >
        {value}
      </div>
      {subtext && (
        <div className="mt-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/60">
          {subtext}
        </div>
      )}
    </div>
  );
}
```

**Verification:**
- Test all variants render correctly
- Check font sizing and spacing match mockup

---

### Task S1-T3: Event Rail Component

**Model:** sonnet

**Files:**
- Create: `components/event-rail.tsx`

**Context:**
- Persistent right sidebar showing live event feed
- Reuses event data structure from existing event-feed.tsx
- Compact event items with colored dots, text, timestamp

**Implementation:**

```tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";

interface EventItem {
  id: string;
  event_type: string;
  summary: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

const eventColors: Record<string, string> = {
  mission_completed: "bg-green-500",
  mission_failed: "bg-red-500",
  mission_started: "bg-blue-500",
  task_completed: "bg-blue-500",
  task_started: "bg-blue-400",
  proposal_approved: "bg-purple-500",
  council_reviewed: "bg-purple-500",
  patrol_complete: "bg-amber-500",
  heartbeat: "bg-muted-foreground/40",
  discovery_created: "bg-amber-500",
  skill_applied: "bg-green-400",
};

export function EventRail() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    if (!supabase) return;

    async function fetchEvents() {
      const { data } = await supabase
        .from("engine_events")
        .select("id, event_type, summary, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        setEvents(data);
        // Count today's events
        const today = new Date().toISOString().split("T")[0];
        const todayEvents = data.filter((e) => e.created_at.startsWith(today));
        setTodayCount(todayEvents.length);
      }
    }

    fetchEvents();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("event-rail")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "engine_events" },
        (payload) => {
          setEvents((prev) => [payload.new as EventItem, ...prev].slice(0, 50));
          setTodayCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex h-full w-[260px] flex-col border-l border-border/50 bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_6px] shadow-green-500" />
        <span className="text-[12px] font-semibold">Live Feed</span>
        <span className="ml-auto font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
          {todayCount} today
        </span>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto py-1">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex gap-2.5 px-4 py-2 transition-colors hover:bg-foreground/[0.02]"
          >
            <span
              className={cn(
                "mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full",
                eventColors[event.event_type] || "bg-muted-foreground/40"
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] leading-[1.4] text-muted-foreground">
                <span className="text-muted-foreground/60">{event.event_type}:</span>{" "}
                {event.summary}
              </div>
              <div className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-muted-foreground/50">
                {formatDistanceToNowStrict(new Date(event.created_at), { addSuffix: true })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Verification:**
- Check realtime subscription works
- Verify scroll behavior
- Test empty state

---

### Task S1-T4: Action Bar Component

**Model:** sonnet

**Files:**
- Create: `components/action-bar.tsx`

**Context:**
- Bottom action bar with ops-focused actions: Run Mission, View Logs, Spawn Agent
- Mission Control style buttons with icons

**Implementation:**

```tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface ActionItem {
  label: string;
  sublabel: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  iconBg: string;
}

const actions: ActionItem[] = [
  {
    label: "Run Mission",
    sublabel: "Execute queued",
    icon: "▸",
    href: "/missions",
    iconBg: "bg-amber-500/15 text-amber-500",
  },
  {
    label: "View Logs",
    sublabel: "Engine events",
    icon: "≡",
    href: "/events",
    iconBg: "bg-blue-500/15 text-blue-500",
  },
  {
    label: "Health",
    sublabel: "System status",
    icon: "♡",
    href: "/health",
    iconBg: "bg-green-500/15 text-green-500",
  },
  {
    label: "Chat",
    sublabel: "Shoin",
    icon: "💬",
    href: "/chat",
    iconBg: "bg-purple-500/15 text-purple-500",
  },
];

export function ActionBar() {
  return (
    <div className="flex gap-2.5 border-t border-border/50 bg-surface px-5 py-3">
      {actions.map((action) => {
        const content = (
          <>
            <div
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base",
                action.iconBg
              )}
            >
              {action.icon}
            </div>
            <div>
              <div className="text-[12px] font-semibold">{action.label}</div>
              <div className="text-[10px] text-muted-foreground/60">{action.sublabel}</div>
            </div>
          </>
        );

        if (action.href) {
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-1 items-center gap-2.5 rounded-xl border border-border/50 bg-surface-2 px-3.5 py-2.5 transition-colors hover:border-border hover:bg-surface-3"
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={action.label}
            onClick={action.onClick}
            className="flex flex-1 items-center gap-2.5 rounded-xl border border-border/50 bg-surface-2 px-3.5 py-2.5 transition-colors hover:border-border hover:bg-surface-3"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
```

**Verification:**
- All buttons render and are clickable
- Links navigate correctly
- Hover states work

---

## Sprint 2: Dashboard Rebuild

### Task S2-T5: Rebuild Dashboard Page

**Model:** sonnet

**Files:**
- Modify: `app/dashboard/page.tsx` (complete rewrite)

**Context:**
- Replace entire dashboard with new layout
- Import new components: SidebarNav, StatCard, EventRail, ActionBar
- Keep existing data fetching from /api/engine-status
- Remove: MorningBrief, AgentSidebar, ObjectiveOverview imports

**Implementation:**

```tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { EngineStatus } from "@/lib/types";
import { SidebarNav } from "@/components/sidebar-nav";
import { StatCard } from "@/components/stat-card";
import { EventRail } from "@/components/event-rail";
import { ActionBar } from "@/components/action-bar";
import { StealthCard } from "@/components/stealth-card";
import { ThemeToggle } from "@/components/theme-toggle";

function ConnectPrompt() {
  return (
    <div className="flex h-full items-center justify-center">
      <StealthCard className="max-w-md p-8 text-center">
        <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold">
          Connect Supabase to see live data
        </h2>
        <p className="text-sm text-muted-foreground">
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local
        </p>
      </StealthCard>
    </div>
  );
}

export default function DashboardPage() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<{ name: string; color: string; status: "idle" | "active" }[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch engine status
        const statusRes = await fetch("/api/engine-status");
        const status = await statusRes.json();
        setEngineStatus(status);

        // Fetch agent status
        if (supabase) {
          const { data: agentData } = await supabase
            .from("agent_status")
            .select("name, status")
            .order("name");

          if (agentData) {
            const colorMap: Record<string, string> = {
              ed: "#3b82f6",
              light: "#a855f7",
              major: "#6b7280",
              makima: "#ef4444",
              toji: "#f59e0b",
            };
            setAgents(
              agentData.map((a) => ({
                name: a.name,
                color: colorMap[a.name.toLowerCase()] || "#6b7280",
                status: a.status === "active" ? "active" : "idle",
              }))
            );
          }
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (!supabase) {
    return (
      <div className="flex h-screen bg-background">
        <SidebarNav />
        <div className="flex-1">
          <ConnectPrompt />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground">
          Loading...
        </p>
      </div>
    );
  }

  const healthVariant = engineStatus?.health === "nominal" ? "success" : engineStatus?.health === "degraded" ? "warning" : "danger";

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <SidebarNav agents={agents} />

      {/* Main Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="flex h-10 flex-shrink-0 items-center gap-4 border-b border-border/50 px-5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_6px] shadow-green-500" />
          <span>Engine Live</span>
          <span className="text-muted-foreground/40">·</span>
          <span>
            Cycle <span className="text-amber-500">{Math.round((engineStatus?.avgCycleMs || 0) / 1000)}s</span>
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>Gateway 198ms</span>
          <span className="flex-1" />
          <ThemeToggle />
          <span className="text-muted-foreground/40">
            {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Stat Cards */}
            <div className="mb-5 grid grid-cols-4 gap-3">
              <StatCard
                label="Engine Health"
                value={engineStatus?.health === "nominal" ? "Nominal" : engineStatus?.health === "degraded" ? "Degraded" : "Down"}
                subtext={`${Math.round((engineStatus?.avgCycleMs || 0) / 1000)}s avg cycle`}
                variant={healthVariant}
              />
              <StatCard
                label="Failures (24h)"
                value={engineStatus?.failures24h || 0}
                subtext={`${engineStatus?.failuresWithCause || 0} with root cause`}
                variant={(engineStatus?.failures24h || 0) > 0 ? "danger" : "success"}
              />
              <StatCard
                label="Need Attention"
                value={engineStatus?.stalledObjectives || 0}
                subtext="stalled objectives"
                variant={(engineStatus?.stalledObjectives || 0) > 0 ? "warning" : "default"}
              />
              <StatCard
                label="Wins (24h)"
                value={engineStatus?.wins24h || 0}
                subtext="missions completed"
                variant="success"
              />
            </div>

            {/* Panels - placeholder for future content */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/50 bg-surface p-4">
                <div className="mb-3 border-b border-border/50 pb-3 text-[12px] font-semibold">
                  Recent Failures
                </div>
                <div className="space-y-3">
                  {(engineStatus?.recentFailures || []).slice(0, 3).map((f, i) => (
                    <div key={i} className="border-l-2 border-red-500 pl-3">
                      <div className="text-[12px] font-medium">{f.title}</div>
                      <div className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground/60">
                        {f.agent} · {f.project}
                      </div>
                      {f.rootCause && (
                        <div className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-red-400/80">
                          {f.rootCause}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!engineStatus?.recentFailures || engineStatus.recentFailures.length === 0) && (
                    <div className="text-[12px] text-muted-foreground/60">No recent failures</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-surface p-4">
                <div className="mb-3 border-b border-border/50 pb-3 text-[12px] font-semibold">
                  System Health
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">Supabase</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-green-500">Connected</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">Claude CLI</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-green-500">Available</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">Avg Cycle</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-amber-500">
                      {Math.round((engineStatus?.avgCycleMs || 0) / 1000)}s
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-green-500">OK</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Event Rail */}
          <EventRail />
        </div>

        {/* Action Bar */}
        <ActionBar />
      </div>
    </div>
  );
}
```

**Verification:**
- `npm run dev` and visit /dashboard
- Verify layout matches mockup
- Check all stat cards display data
- Verify event rail shows live events

---

## Sprint 3: Navigation Cleanup

### Task S3-T6: Update globals.css with surface colors

**Model:** sonnet

**Files:**
- Modify: `app/globals.css`

**Context:**
- Add surface color variables if not present (surface, surface-2, surface-3)
- These are used by new components

**Implementation:**

Add to `:root` and `.dark` sections:

```css
/* In :root */
--surface: #fafafa;
--surface-2: #f5f5f5;
--surface-3: #ebebeb;

/* In .dark */
--surface: #131313;
--surface-2: #1a1a1a;
--surface-3: #222222;
```

And add utility classes:

```css
.bg-surface { background-color: var(--surface); }
.bg-surface-2 { background-color: var(--surface-2); }
.bg-surface-3 { background-color: var(--surface-3); }
```

**Verification:**
- Components use correct surface colors in both themes

---

### Task S3-T7: Hide stripped routes from navigation

**Model:** sonnet

**Files:**
- Note: Routes `/objectives`, `/council`, `/brief` stay in codebase but are NOT linked from new SidebarNav
- No code changes needed — they're already excluded from the nav sections in sidebar-nav.tsx

**Context:**
- Objectives, council, brief pages remain accessible by direct URL for legacy access
- They're just not in the navigation anymore
- Chat stays accessible via action bar

**Verification:**
- `/objectives` still loads if accessed directly
- `/council` still loads if accessed directly
- Neither appears in sidebar nav

---

## Parallel Execution Groups

**Group A (Sprint 1 - all parallel):**
- S1-T1: Sidebar Navigation
- S1-T2: Stat Card
- S1-T3: Event Rail
- S1-T4: Action Bar

**Sequential (Sprint 2):**
- S2-T5: Dashboard Rebuild (depends on Group A)

**Group B (Sprint 3 - parallel):**
- S3-T6: CSS updates
- S3-T7: Verification (no changes needed)

---

## Post-Implementation Checklist

- [ ] `npm run build` passes
- [ ] Dashboard loads with new layout
- [ ] Event rail shows realtime updates
- [ ] All nav links work
- [ ] Theme toggle works
- [ ] Mobile responsiveness (future enhancement)
- [ ] Commit and push to feature branch
