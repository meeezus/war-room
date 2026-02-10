"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getProjectWithBoards } from "@/lib/queries";
import type { Project, Board, Task } from "@/lib/types";
import { ProjectDetail } from "@/components/project-detail";
import { StealthCard } from "@/components/stealth-card";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [boards, setBoards] = useState<(Board & { tasks: Task[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!params.id) return;
      const data = await getProjectWithBoards(params.id);
      setProject(data.project);
      setBoards(data.boards);
      setLoading(false);
    }
    fetchData();
  }, [params.id]);

  if (!supabase) {
    return (
      <div className="flex h-screen flex-col bg-background p-4">
        <div className="flex h-full items-center justify-center">
          <StealthCard className="max-w-md p-8 text-center">
            <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-[#E5E5E5]">
              Connect Supabase to see live data
            </h2>
          </StealthCard>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-[rgba(255,255,255,0.4)]">
          Loading project...
        </p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <StealthCard className="max-w-sm p-8 text-center">
          <h2 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-[#E5E5E5]">
            Project not found
          </h2>
          <p className="text-sm text-[rgba(255,255,255,0.4)]">
            The project you are looking for does not exist or has been removed.
          </p>
        </StealthCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ProjectDetail project={project} boards={boards} />
    </div>
  );
}
