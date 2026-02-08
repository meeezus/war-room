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
        "relative rounded-sm border border-white/[0.08] bg-[rgba(10,10,10,0.8)] backdrop-blur-xl shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[60px] before:rounded-t-sm before:bg-gradient-to-b before:from-white/[0.02] before:to-transparent",
        hover && "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:border-white/[0.15] hover:bg-[rgba(15,15,15,0.85)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
        className
      )}
    >
      {children}
    </div>
  );
}
