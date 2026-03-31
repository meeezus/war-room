"use client";

import { useState, useEffect } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNowStrict } from "date-fns";

const DOMAINS = [
  { value: "engineering", label: "Engineering" },
  { value: "product", label: "Product" },
  { value: "commerce", label: "Commerce" },
  { value: "influence", label: "Influence" },
  { value: "operations", label: "Operations" },
  { value: "coordination", label: "Coordination" },
];

const PRIORITIES = [
  { value: "1", label: "P1 — Critical" },
  { value: "2", label: "P2 — High" },
  { value: "3", label: "P3 — Normal" },
  { value: "4", label: "P4 — Low" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-400 bg-amber-400/10",
  approved: "text-green-400 bg-green-400/10",
  rejected: "text-red-400 bg-red-400/10",
  running: "text-blue-400 bg-blue-400/10",
  completed: "text-zinc-400 bg-zinc-400/10",
};

interface Agent {
  name: string;
  display_name: string;
}

interface Proposal {
  id: string;
  title: string;
  status: string;
  domain: string;
  created_at: string;
}

export default function SpawnPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("engineering");
  const [agent, setAgent] = useState("");
  const [priority, setPriority] = useState("3");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!supabase) return;

    supabase
      .from("agent_status")
      .select("name, display_name")
      .order("name")
      .then(({ data }) => {
        if (data) setAgents(data);
      });

    fetchProposals();
  }, []);

  async function fetchProposals() {
    if (!supabase) return;
    const { data } = await supabase
      .from("proposals")
      .select("id, title, status, domain, created_at")
      .eq("source", "manual")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setProposals(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setFeedback({ type: "error", message: "Supabase not configured." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);

    const priorityNum = parseInt(priority);
    const { error } = await supabase.from("proposals").insert({
      id: crypto.randomUUID(),
      title,
      description,
      domain,
      requested_by: "sensei",
      source: "manual",
      status: "pending",
      risk_level: priorityNum <= 2 ? "high" : "low",
    });

    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      setFeedback({ type: "success", message: "Proposal created." });
      setTitle("");
      setDescription("");
      setDomain("engineering");
      setAgent("");
      setPriority("3");
      fetchProposals();
    }
    setSubmitting(false);
  }

  const inputClass =
    "w-full bg-surface border border-border/50 rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500/60";
  const labelClass = "block text-xs text-muted-foreground mb-1 uppercase tracking-wider";

  return (
    <div className="flex h-screen bg-background text-foreground font-[family-name:var(--font-space-grotesk)]">
      <SidebarNav />

      <main className="flex-1 overflow-y-auto p-4 pt-14 sm:p-8 lg:pt-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-semibold tracking-wide mb-6">Spawn Agent Task</h1>

          <form onSubmit={handleSubmit} className="space-y-4 mb-10">
            <div>
              <label className={labelClass}>Title</label>
              <input
                type="text"
                className={inputClass}
                placeholder="What should the agent do?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea
                className={cn(inputClass, "h-24 resize-none")}
                placeholder="Additional context or instructions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Domain</label>
                <select
                  className={inputClass}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                >
                  {DOMAINS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Priority</label>
                <select
                  className={inputClass}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Agent (optional)</label>
              <select
                className={inputClass}
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
              >
                <option value="">— Any available agent —</option>
                {agents.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.display_name || a.name}
                  </option>
                ))}
              </select>
            </div>

            {feedback && (
              <p
                className={cn(
                  "text-sm",
                  feedback.type === "success" ? "text-green-400" : "text-red-400"
                )}
              >
                {feedback.message}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded px-4 py-2 transition-colors"
            >
              {submitting ? "Creating..." : "Create Proposal"}
            </button>
          </form>

          {proposals.length > 0 && (
            <div>
              <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Recent Manual Proposals
              </h2>
              <ul className="space-y-2">
                {proposals.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between bg-surface border border-border/30 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded font-[family-name:var(--font-jetbrains-mono)] shrink-0",
                          STATUS_COLORS[p.status] ?? "text-zinc-400 bg-zinc-400/10"
                        )}
                      >
                        {p.status}
                      </span>
                      <span className="text-sm truncate">{p.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-xs text-muted-foreground">{p.domain}</span>
                      <span className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                        {formatDistanceToNowStrict(new Date(p.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
