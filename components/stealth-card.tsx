"use client";

import { cn } from "@/lib/utils";

interface StealthCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function StealthCard({ children, className, hover = true }: StealthCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-sm border border-border bg-card backdrop-blur-xl",
        "shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[60px] before:rounded-t-sm before:bg-gradient-to-b before:from-black/[0.02] before:to-transparent dark:before:from-white/[0.02]",
        hover && "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:border-border hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
        className
      )}
    >
      {children}
    </div>
  );
}
