"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
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
    title: "",
    items: [
      { label: "Overview", href: "/dashboard", icon: "◉" },
      { label: "Agents", href: "/agents", icon: "◎" },
      { label: "Tasks", href: "/tasks", icon: "☰" },
      { label: "Sessions", href: "/sessions", icon: "▹" },
    ],
  },
  {
    title: "OBSERVE",
    items: [
      { label: "Activity", href: "/events", icon: "≡" },
      { label: "Research", href: "/research", icon: "⊡" },
      { label: "Logs", href: "/logs", icon: "⊞" },
      { label: "Tokens", href: "/tokens", icon: "◈" },
      { label: "Memory", href: "/memory", icon: "◇" },
    ],
  },
  {
    title: "AUTOMATE",
    items: [
      { label: "Cron", href: "/cron", icon: "⟳" },
      { label: "Spawn", href: "/spawn", icon: "⊕" },
      { label: "Alerts", href: "/alerts", icon: "△" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Health", href: "/health", icon: "♡" },
      { label: "Discoveries", href: "/discoveries", icon: "◬" },
      { label: "Settings", href: "/settings", icon: "⚙" },
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

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tenshu-collapsed-groups");
      if (stored) setCollapsedGroups(JSON.parse(stored));
    } catch {}
  }, []);

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
        {sections.map((section) => {
          const isCore = section.title === "";
          const isCollapsed = !isCore && collapsedGroups.includes(section.title);

          return (
            <div key={section.title || "core"} className="mb-2">
              {/* Section header — only for labeled groups */}
              {!isCore && (
                <button
                  onClick={() => toggleGroup(section.title)}
                  className="flex w-full items-center justify-between px-4 py-2 hover:text-foreground"
                >
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[9px] font-semibold uppercase tracking-[1.5px] text-muted-foreground/60">
                    {section.title}
                  </span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-muted-foreground/40">
                    {isCollapsed ? "›" : "⌄"}
                  </span>
                </button>
              )}

              {/* Items */}
              {!isCollapsed &&
                section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 border-l-2 border-transparent px-4 py-[7px] text-[13px] text-muted-foreground transition-all hover:bg-foreground/[0.03] hover:text-foreground",
                        isActive &&
                          "border-l-blue-500 bg-foreground/[0.05] text-foreground"
                      )}
                    >
                      <span className="w-4 text-center text-sm opacity-60">
                        {item.icon}
                      </span>
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
          );
        })}
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
