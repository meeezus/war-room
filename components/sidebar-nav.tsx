"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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
  const [mobileOpen, setMobileOpen] = useState(false);
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

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  const handleMobileLinkClick = useCallback(() => {
    setMobileOpen(false);
  }, []);

  // Shared nav content renderer (used by both desktop and mobile)
  function renderNavContent(isMobileOverlay = false) {
    const showCollapsed = !isMobileOverlay && collapsed;

    return (
      <>
        {/* Brand */}
        <div className={cn("border-b border-border/50", showCollapsed ? "px-2 py-4" : "px-4 py-4")}>
          <h1 className={cn(
            "font-[family-name:var(--font-space-grotesk)] font-bold tracking-tight",
            showCollapsed ? "text-center text-[13px]" : "text-[15px]"
          )}>
            {showCollapsed ? "T" : "Tenshu"}
          </h1>
          {!showCollapsed && (
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
                {!isCore && !showCollapsed && (
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
                        title={showCollapsed ? item.label : undefined}
                        onClick={isMobileOverlay ? handleMobileLinkClick : undefined}
                        className={cn(
                          "flex items-center border-l-2 border-transparent text-muted-foreground transition-all hover:bg-foreground/[0.03] hover:text-foreground",
                          showCollapsed
                            ? "justify-center px-1 py-[7px] text-sm"
                            : "gap-2.5 px-4 py-[10px] text-[13px]",
                          isMobileOverlay && "min-h-[44px]",
                          isActive &&
                            "border-l-blue-500 bg-foreground/[0.05] text-foreground"
                        )}
                      >
                        <span className="w-4 text-center text-sm opacity-60">
                          {item.icon}
                        </span>
                        {!showCollapsed && (
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
        {!showCollapsed && agents.length > 0 && (
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

        {/* Footer: Theme Toggle + Collapse Button (desktop only) */}
        {!isMobileOverlay && (
          <div className={cn(
            "mt-auto border-t border-border/50",
            showCollapsed ? "flex flex-col items-center gap-1 py-2" : "px-3 py-3"
          )}>
            <ThemeToggle collapsed={showCollapsed} />
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "rounded-sm text-muted-foreground/60 hover:text-foreground transition-colors",
                showCollapsed
                  ? "flex h-7 w-7 items-center justify-center text-sm"
                  : "mt-1 flex w-full items-center gap-2 px-1 py-1 text-[11px] hover:bg-foreground/[0.03]"
              )}
            >
              <span className="font-[family-name:var(--font-jetbrains-mono)]">
                {showCollapsed ? "\u00BB" : "\u00AB"}
              </span>
              {!showCollapsed && (
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-muted-foreground/40">
                  Collapse
                </span>
              )}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Mobile hamburger toggle -- visible only on <lg screens */}
      <button
        data-testid="mobile-sidebar-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="fixed left-3 top-2 z-40 flex h-9 w-9 items-center justify-center rounded-sm bg-surface/80 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground lg:hidden"
      >
        <span className="text-lg">&#9776;</span>
      </button>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div data-testid="mobile-sidebar-overlay" className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            data-testid="mobile-sidebar-backdrop"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sidebar panel */}
          <div className="relative z-10 flex h-full w-[240px] flex-col bg-surface shadow-xl">
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* Desktop sidebar -- hidden on mobile */}
      <nav
        className={cn(
          "hidden h-full flex-col border-r border-border/50 bg-surface transition-all duration-200 lg:flex",
          collapsed ? "w-12" : "w-[200px]"
        )}
      >
        {renderNavContent(false)}
      </nav>
    </>
  );
}
