"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getAgentWithHistory } from "@/lib/queries";
import type { AgentStatus, Mission, Event } from "@/lib/types";
import { AgentDetail } from "@/components/agent-detail";
import { StealthCard } from "@/components/stealth-card";

function ConnectPrompt() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
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
      </StealthCard>
    </div>
  );
}

export default function AgentPage() {
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const data = await getAgentWithHistory(id);
      setAgent(data.agent);
      setMissions(data.missions);
      setEvents(data.events);
      setLoading(false);
    }
    fetchData();
  }, [id]);

  if (!supabase) {
    return <ConnectPrompt />;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-[rgba(255,255,255,0.4)]">
          Loading...
        </p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <StealthCard className="max-w-sm p-8 text-center">
          <h2 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-[#E5E5E5]">
            Agent not found
          </h2>
          <p className="text-sm text-[rgba(255,255,255,0.4)]">
            No agent exists with ID{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs">
              {id}
            </code>
          </p>
        </StealthCard>
      </div>
    );
  }

  return <AgentDetail agent={agent} missions={missions} events={events} />;
}
