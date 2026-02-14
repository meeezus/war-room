"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMissionWithTasks } from "@/lib/queries";
import type { Mission, Task } from "@/lib/types";
import { MissionDetail } from "@/components/mission-detail";
import { StealthCard } from "@/components/stealth-card";

function ConnectPrompt() {
  return (
    <div className="flex h-full items-center justify-center">
      <StealthCard className="max-w-md p-8 text-center">
        <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-[#E5E5E5]">
          Connect Supabase to see live data
        </h2>
        <p className="mb-4 text-sm text-[rgba(255,255,255,0.5)]">
          Add these environment variables to your{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs">
            .env.local
          </code>{" "}
          file:
        </p>
        <div className="rounded-sm bg-white/[0.04] p-4 text-left font-[family-name:var(--font-jetbrains-mono)] text-xs text-[rgba(255,255,255,0.5)]">
          <p>NEXT_PUBLIC_SUPABASE_URL=your-url</p>
          <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key</p>
        </div>
        <p className="mt-4 text-xs text-[rgba(255,255,255,0.3)]">
          Then restart the dev server.
        </p>
      </StealthCard>
    </div>
  );
}

export default function MissionPage() {
  const params = useParams<{ id: string }>();
  const [mission, setMission] = useState<Mission | null>(null);
  const [steps, setSteps] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!params.id) return;
      const data = await getMissionWithTasks(params.id);
      setMission(data.mission);
      setSteps(data.tasks);
      setLoading(false);
    }
    fetchData();
  }, [params.id]);

  if (!supabase) {
    return (
      <div className="flex h-screen flex-col bg-background p-4">
        <ConnectPrompt />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-[rgba(255,255,255,0.4)]">
          Loading mission...
        </p>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <StealthCard className="max-w-sm p-8 text-center">
          <h2 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-[#E5E5E5]">
            Mission not found
          </h2>
          <p className="text-sm text-[rgba(255,255,255,0.4)]">
            The mission you are looking for does not exist or has been removed.
          </p>
        </StealthCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MissionDetail mission={mission} steps={steps} />
    </div>
  );
}
