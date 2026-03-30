"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

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
    title: "",
    items: [
      { label: "Overview", href: "/dashboard", icon: "\u25C9" },
      { label: "Agents", href: "/agents", icon: "\u25CE" },
      { label: "Tasks", href: "/tasks", icon: "\u2630" },
      { label: "Sessions", href: "/sessions", icon: "\u25B9" },
    ],
  },
  {
    title: "OBSERVE",
    items: [
      { label: "Research", href: "/research", icon: "\u22A1" },
      { label: "Tokens", href: "/tokens", icon: "\u25C8" },
      { label: "Memory", href: "/memory", icon: "\u25C7" },
    ],
  },
  {
    title: "AUTOMATE",
    items: [
      { label: "Plans", href: "/plans", icon: "\u25B9" },
      { label: "Cron", href: "/cron", icon: "\u27F3" },
      { label: "Spawn", href: "/spawn", icon: "\u2295" },
      { label: "Alerts", href: "/alerts", icon: "\u25B3" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Health", href: "/health", icon: "\u2661" },
      { label: "Discoveries", href: "/discoveries", icon: "\u25EC" },
      { label: "Settings", href: "/settings", icon: "\u2699" },
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
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("tenshu-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tenshu-collapsed-groups");
      if (stored) setCollapsedGroups(JSON.parse(stored));
    } catch {}
  }, []);

  // Persist sidebar collapsed state
  useEffect(() => {
    try {
      localStorage.setItem("tenshu-sidebar-collapsed", String(collapsed));
    } catch {}
  }, [collapsed]);

  function toggleGroup(title: string) {
    setCollapsedGroups((prev) => {
      const next = prev.includes(title)
        ? prev.filter((g) => g !== title)
        : [...prev, title];
      try {
        localStorage.setItem("tenshu-collapsed-groups", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  return (
    <nav
      className={cn(
        "flex h-full flex-col border-r border-border/50 bg-surface transition-all duration-200",
        collapsed ? "w-12" : "w-[200px]"
      )}
    >
      {/* Brand */}
      <div className={cn("border-b border-border/50", collapsed ? "px-2 py-4" : "px-4 py-4")}>
        <h1 className={cn(
          "font-[family-name:var(--font-space-grotesk)] font-bold tracking-tight",
          collapsed ? "text-center text-[13px]" : "text-[15px]"
        )}>
          {collapsed ? "T" : "Tenshu"}
        </h1>
        {!collapsed && (
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
            v2.0 &mdash; Shogunate
          </span>
        )}
      </div>

      {/* Nav Sections */}
      <div className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => {
          const isCore = section.title === "";
          const isGroupCollapsed = !isCore && collapsedGroups.includes(section.title);

          return (
            <div key={section.title || "core"} className="mb-2">
              {/* Section header -- only for labeled groups, hidden when sidebar collapsed */}
              {!isCore && !collapsed && (
                <button
                  onClick={() => toggleGroup(section.title)}
                  className="flex w-full items-center justify-between px-4 py-2 hover:text-foreground"
                >
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[9px] font-semibold uppercase tracking-[1.5px] text-muted-foreground/60">
                    {section.title}
                  </span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-muted-foreground/40">
                    {isGroupCollapsed ? "\u203A" : "\u2304"}
                  </span>
                </button>
              )}

              {/* Items */}
              {!isGroupCollapsed &&
                section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center border-l-2 border-transparent text-muted-foreground transition-all hover:bg-foreground/[0.03] hover:text-foreground",
                        collapsed
                          ? "justify-center px-1 py-[7px] text-sm"
                          : "gap-2.5 px-4 py-[7px] text-[13px]",
                        isActive &&
                          "border-l-blue-500 bg-foreground/[0.05] text-foreground"
                      )}
                    >
                      <span className="w-4 text-center text-sm opacity-60">
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <>
                          {item.label}
                          {item.badge && (
                            <span className="ml-auto rounded-lg bg-red-500/15 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-red-400">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* Agents at bottom -- hidden when collapsed */}
      {!collapsed && agents.length > 0 && (
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

      {/* Footer: Theme Toggle + Collapse Button */}
      <div className={cn(
        "mt-auto border-t border-border/50",
        collapsed ? "flex flex-col items-center gap-1 py-2" : "px-3 py-3"
      )}>
        <ThemeToggle collapsed={collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "rounded-sm text-muted-foreground/60 hover:text-foreground transition-colors",
            collapsed
              ? "flex h-7 w-7 items-center justify-center text-sm"
              : "mt-1 flex w-full items-center gap-2 px-1 py-1 text-[11px] hover:bg-foreground/[0.03]"
          )}
        >
          <span className="font-[family-name:var(--font-jetbrains-mono)]">
            {collapsed ? "\u00BB" : "\u00AB"}
          </span>
          {!collapsed && (
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-muted-foreground/40">
              Collapse
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
