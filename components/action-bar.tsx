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
    label: "Spawn Agent",
    sublabel: "Launch new agent",
    icon: "⊕",
    href: "/spawn",
    iconBg: "bg-amber-500/15 text-amber-500",
  },
  {
    label: "View Logs",
    sublabel: "Engine events",
    icon: "⊞",
    href: "/logs",
    iconBg: "bg-blue-500/15 text-blue-500",
  },
  {
    label: "Task Board",
    sublabel: "Active tasks",
    icon: "☰",
    href: "/tasks",
    iconBg: "bg-green-500/15 text-green-500",
  },
  {
    label: "Memory",
    sublabel: "Agent memory",
    icon: "◇",
    href: "/memory",
    iconBg: "bg-purple-500/15 text-purple-500",
  },
  {
    label: "Sessions",
    sublabel: "Active sessions",
    icon: "▹",
    href: "/sessions",
    iconBg: "bg-cyan-500/15 text-cyan-500",
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
