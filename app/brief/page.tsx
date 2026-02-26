"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface BriefData {
  html: string;
  generated_at: string;
}

export default function BriefPage() {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/brief/latest")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch brief");
        return r.json();
      })
      .then((data: BriefData) => setBrief(data))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground/60 transition-colors"
          >
            ← Dashboard
          </Link>
          <span className="text-xs text-muted-foreground/60">/</span>
          <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-medium text-foreground/60">
            Brief
          </span>
        </div>

        <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground mb-2">
          Daily Brief
        </h1>

        {brief?.generated_at && (
          <p className="text-xs text-muted-foreground mb-6 font-[family-name:var(--font-jetbrains-mono)]">
            Generated {new Date(brief.generated_at).toLocaleString()}
          </p>
        )}

        {error ? (
          <div className="rounded-sm border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-sm text-red-400">Failed to load brief</p>
            <p className="text-xs text-muted-foreground/75 mt-1">Check if the brief API is running</p>
          </div>
        ) : !brief ? (
          <p className="text-sm text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
            Loading brief...
          </p>
        ) : (
          <iframe
            srcDoc={brief.html}
            className="w-full border-0 rounded-sm"
            style={{ minHeight: "80vh" }}
            sandbox="allow-scripts allow-same-origin"
            onLoad={(e) => {
              // Auto-resize iframe to content height
              const iframe = e.currentTarget;
              const resize = () => {
                try {
                  const h = iframe.contentDocument?.documentElement?.scrollHeight;
                  if (h) iframe.style.height = h + 32 + "px";
                } catch { /* cross-origin fallback */ }
              };
              resize();
              // Re-check after images/fonts load
              setTimeout(resize, 500);
            }}
          />
        )}
      </div>
    </div>
  );
}
