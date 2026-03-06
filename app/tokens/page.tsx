"use client"

import { useState, useEffect } from 'react'
import { Breadcrumb } from '@/components/breadcrumb'
import type { CodexBarResult, CodexBarProvider, CodexBarDailyEntry } from '@/lib/codexbar'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatResetTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function quotaColor(pct: number): string {
  if (pct > 80) return 'bg-red-500'
  if (pct > 50) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function quotaTextColor(pct: number): string {
  if (pct > 80) return 'text-red-400'
  if (pct > 50) return 'text-amber-400'
  return 'text-emerald-400'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QuotaBar({ provider }: { provider: CodexBarProvider }) {
  const { percentUsed, resetTime, windowName } = provider.quotaInfo
  const pct = Math.min(100, Math.max(0, percentUsed))

  return (
    <div className="rounded-sm border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-foreground">
          {provider.name}
        </span>
        <span className={`font-[family-name:var(--font-jetbrains-mono)] text-xs font-medium ${quotaTextColor(pct)}`}>
          {pct.toFixed(1)}% used
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${quotaColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="capitalize">{windowName} quota</span>
        {resetTime && (
          <span>Resets {formatResetTime(resetTime)}</span>
        )}
      </div>
    </div>
  )
}

function SessionStats({ provider }: { provider: CodexBarProvider }) {
  const { cost, inputTokens, outputTokens } = provider.currentSession

  return (
    <div className="rounded-sm border border-border bg-muted/20 p-4">
      <h3 className="font-[family-name:var(--font-space-grotesk)] text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Current Session — {provider.name}
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-lg font-medium text-foreground">
            {formatCost(cost)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Cost</p>
        </div>
        <div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-lg font-medium text-foreground">
            {formatTokens(inputTokens)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Input tokens</p>
        </div>
        <div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-lg font-medium text-foreground">
            {formatTokens(outputTokens)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Output tokens</p>
        </div>
      </div>
    </div>
  )
}

function DailyChart({ dailyUsage, providerName }: { dailyUsage: CodexBarDailyEntry[]; providerName: string }) {
  const last14 = dailyUsage.slice(-14)

  if (last14.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-muted/20 p-4">
        <h3 className="font-[family-name:var(--font-space-grotesk)] text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Daily Usage — {providerName}
        </h3>
        <p className="text-xs text-muted-foreground">No daily usage data available.</p>
      </div>
    )
  }

  const maxCost = Math.max(...last14.map(d => d.cost), 0.01)

  return (
    <div className="rounded-sm border border-border bg-muted/20 p-4">
      <h3 className="font-[family-name:var(--font-space-grotesk)] text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Daily Usage — {providerName}
      </h3>

      {/* Bar chart */}
      <div className="flex items-end gap-1 h-24">
        {last14.map((entry) => {
          const heightPct = maxCost > 0 ? (entry.cost / maxCost) * 100 : 0
          const dateLabel = entry.date.slice(5) // MM-DD
          return (
            <div key={entry.date} className="flex flex-col items-center flex-1 gap-1 group">
              <div
                className="relative w-full flex items-end justify-center"
                style={{ height: '80px' }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-foreground text-background rounded px-2 py-1 text-xs whitespace-nowrap font-[family-name:var(--font-jetbrains-mono)]">
                    {formatCost(entry.cost)}
                    <br />
                    {formatTokens(entry.inputTokens + entry.outputTokens)} tok
                  </div>
                </div>
                <div
                  className="w-full rounded-t-sm bg-emerald-500/70 hover:bg-emerald-500 transition-colors min-h-[2px]"
                  style={{ height: `${Math.max(2, heightPct)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] rotate-0">
                {dateLabel}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TotalsCard({ dailyUsage, providerName }: { dailyUsage: CodexBarDailyEntry[]; providerName: string }) {
  const last30 = dailyUsage.slice(-30)
  const totalCost = last30.reduce((sum, d) => sum + d.cost, 0)
  const totalInput = last30.reduce((sum, d) => sum + d.inputTokens, 0)
  const totalOutput = last30.reduce((sum, d) => sum + d.outputTokens, 0)
  const totalTokens = totalInput + totalOutput

  return (
    <div className="rounded-sm border border-border bg-muted/20 p-4">
      <h3 className="font-[family-name:var(--font-space-grotesk)] text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        30-Day Totals — {providerName}
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-xl font-medium text-foreground">
            {formatCost(totalCost)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Total cost</p>
        </div>
        <div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-xl font-medium text-foreground">
            {formatTokens(totalTokens)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Total tokens</p>
        </div>
        <div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-xl font-medium text-foreground">
            {formatTokens(totalInput)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Input tokens</p>
        </div>
        <div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-xl font-medium text-foreground">
            {formatTokens(totalOutput)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Output tokens</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TokensPage() {
  const [data, setData] = useState<CodexBarResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsage() {
      setLoading(true)
      try {
        const res = await fetch('/api/usage')
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch {
        setData({ error: 'Failed to fetch usage data', providers: [] })
      } finally {
        setLoading(false)
      }
    }
    fetchUsage()
  }, [])

  const notInstalled = !loading && (data?.error === 'CodexBar not found' || (data?.providers?.length === 0 && !data?.lastUpdated))

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Breadcrumb segments={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Tokens' },
          ]} className="mb-4" />
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground">
            Tokens &amp; Usage
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Token and cost tracking via CodexBar
          </p>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-sm border border-border bg-muted/30 h-24 animate-pulse" />
            ))}
          </div>
        )}

        {/* Not installed */}
        {!loading && notInstalled && (
          <div className="rounded-sm border border-border bg-muted/20 p-12 text-center">
            <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-foreground mb-2">
              CodexBar not installed
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Install{' '}
              <a
                href="https://codexbar.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:no-underline"
              >
                CodexBar
              </a>
              {' '}to track API usage and costs across providers.
            </p>
          </div>
        )}

        {/* Error state (not ENOENT) */}
        {!loading && !notInstalled && data?.error && (
          <div className="rounded-sm border border-red-800 bg-red-500/10 p-4 text-sm text-red-400 font-[family-name:var(--font-jetbrains-mono)]">
            {data.error}
          </div>
        )}

        {/* Provider data */}
        {!loading && data && data.providers.length > 0 && (
          <div className="flex flex-col gap-8">
            {data.providers.map((provider) => (
              <section key={provider.name} className="flex flex-col gap-4">
                {/* Quota bar */}
                {provider.quotaInfo && (
                  <QuotaBar provider={provider} />
                )}

                {/* Current session */}
                {provider.currentSession && (
                  <SessionStats provider={provider} />
                )}

                {/* Daily chart */}
                {provider.dailyUsage && (
                  <DailyChart dailyUsage={provider.dailyUsage} providerName={provider.name} />
                )}

                {/* 30-day totals */}
                {provider.dailyUsage && provider.dailyUsage.length > 0 && (
                  <TotalsCard dailyUsage={provider.dailyUsage} providerName={provider.name} />
                )}
              </section>
            ))}

            {/* Last updated */}
            {data.lastUpdated && (
              <p className="text-xs text-muted-foreground text-right font-[family-name:var(--font-jetbrains-mono)]">
                Last updated: {formatResetTime(data.lastUpdated)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
