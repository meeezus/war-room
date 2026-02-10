"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { Project } from "@/lib/types";
import { PROJECT_STATUS_COLORS } from "@/lib/data";
import { hoverLift, tapScale, SPRING_CONFIG } from "@/lib/motion";
import { StealthCard } from "./stealth-card";

export function ProjectCard({ project }: { project: Project }) {
  const prefersReducedMotion = useReducedMotion();
  const accent = PROJECT_STATUS_COLORS[project.status] ?? "#6b7280";

  return (
    <Link href={`/projects/${project.id}`}>
      <motion.div
        whileTap={prefersReducedMotion ? undefined : tapScale}
        whileHover={prefersReducedMotion ? undefined : hoverLift}
        transition={SPRING_CONFIG}
      >
        <StealthCard className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-[#E5E5E5]">
              {project.title}
            </h3>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium"
              style={{ backgroundColor: `${accent}20`, color: accent }}
            >
              <span
                className="inline-block size-1.5 rounded-full"
                style={{ backgroundColor: accent }}
              />
              {project.status}
            </span>
          </div>

          {project.goal && (
            <p className="mt-2 line-clamp-2 text-xs text-[rgba(255,255,255,0.4)]">
              {project.goal}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {project.type && (
              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40">
                {project.type}
              </span>
            )}
            {project.owner && (
              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40">
                {project.owner}
              </span>
            )}
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-400">
              P{project.priority}
            </span>
          </div>
        </StealthCard>
      </motion.div>
    </Link>
  );
}
