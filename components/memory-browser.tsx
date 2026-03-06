"use client"

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNowStrict } from 'date-fns'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'skills' | 'authority'

interface SkillPatch {
  id: string
  agent_id: string
  pattern_name: string
  title?: string
  applied: boolean
  created_at: string
}

interface Discovery {
  id: string
  agent_id: string
  category: string
  severity: string
  title: string
  description: string
  status: string
  created_at: string
}

interface AuthorityDomain {
  tier: string
  totalMissions: number
  successful: number
  successRate: number
}

interface AuthorityData {
  enabled: boolean
  threshold: number
  domains: Record<string, AuthorityDomain>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20'
    case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20'
    case 'medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    default: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  }
}

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'approved': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    case 'pending': return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    case 'rejected': return 'text-red-400 bg-red-500/10 border-red-500/20'
    default: return 'text-muted-foreground bg-muted/20 border-border'
  }
}

function tierColor(tier: string): string {
  if (tier === 'auto-approve') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
}

// ---------------------------------------------------------------------------
// Tab: Skills
// ---------------------------------------------------------------------------

function SkillsTab() {
  const [patches, setPatches] = useState<SkillPatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoading(false); return }
      const { data } = await supabase
        .from('skill_patches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      setPatches((data as SkillPatch[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSkeleton />
  if (patches.length === 0) return <EmptyState message="No skill patches recorded." />

  return (
    <div className="flex flex-col gap-1">
      {patches.map((patch) => (
        <div
          key={patch.id}
          className="flex items-start justify-between gap-4 rounded-sm border border-border/50 bg-muted/10 px-4 py-3 hover:bg-muted/20 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-space-grotesk)] text-[12px] font-medium text-foreground truncate">
              {patch.title ?? patch.pattern_name}
            </p>
            <p className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
              {patch.agent_id} · {relativeTime(patch.created_at)}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded border px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px]',
              patch.applied
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-border bg-muted/20 text-muted-foreground'
            )}
          >
            {patch.applied ? 'applied' : 'pending'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Discoveries
// ---------------------------------------------------------------------------

function DiscoveriesTab() {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoading(false); return }
      const { data } = await supabase
        .from('discoveries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      setDiscoveries((data as Discovery[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSkeleton />
  if (discoveries.length === 0) return <EmptyState message="No discoveries recorded." />

  return (
    <div className="flex flex-col gap-1">
      {discoveries.map((d) => (
        <div
          key={d.id}
          className="rounded-sm border border-border/50 bg-muted/10 px-4 py-3 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-start justify-between gap-4 mb-1">
            <p className="font-[family-name:var(--font-space-grotesk)] text-[12px] font-medium text-foreground truncate flex-1">
              {d.title}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn('rounded border px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px]', severityColor(d.severity))}>
                {d.severity}
              </span>
              <span className={cn('rounded border px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px]', statusColor(d.status))}>
                {d.status}
              </span>
            </div>
          </div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
            {d.agent_id} · {d.category} · {relativeTime(d.created_at)}
          </p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Authority
// ---------------------------------------------------------------------------

function AuthorityTab() {
  const [authority, setAuthority] = useState<AuthorityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/engine-status')
        if (res.ok) {
          const json = await res.json()
          setAuthority(json.authority ?? null)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingSkeleton />

  const domains = authority?.domains ?? {}
  const domainEntries = Object.entries(domains)

  if (domainEntries.length === 0) {
    return <EmptyState message="No authority domains recorded." />
  }

  return (
    <div className="flex flex-col gap-2">
      {authority && (
        <div className="flex items-center gap-3 mb-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">
          <span>threshold: {(authority.threshold * 100).toFixed(0)}%</span>
          <span className={cn(
            'rounded border px-1.5 py-0.5 text-[10px]',
            authority.enabled
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-border bg-muted/20 text-muted-foreground'
          )}>
            {authority.enabled ? 'enabled' : 'disabled'}
          </span>
        </div>
      )}
      {domainEntries.map(([domain, info]) => (
        <div
          key={domain}
          className="rounded-sm border border-border/50 bg-muted/10 px-4 py-3"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="font-[family-name:var(--font-space-grotesk)] text-[12px] font-medium text-foreground">
              {domain}
            </p>
            <span className={cn('rounded border px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px]', tierColor(info.tier))}>
              {info.tier}
            </span>
          </div>

          {/* Success rate bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-all duration-500"
              style={{ width: `${Math.min(100, (info.successRate ?? 0) * 100)}%` }}
            />
          </div>

          <div className="flex items-center gap-4 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
            <span>{((info.successRate ?? 0) * 100).toFixed(0)}% success</span>
            <span>{info.successful}/{info.totalMissions} missions</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-sm border border-border bg-muted/20 h-14 animate-pulse" />
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-sm border border-border bg-muted/10 p-8 text-center">
      <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MemoryBrowser (main export)
// ---------------------------------------------------------------------------

export function MemoryBrowser() {
  const [tab, setTab] = useState<Tab>('skills')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'skills', label: 'Skills' },
    { id: 'authority', label: 'Authority' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Tab pills */}
      <div className="flex items-center gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-full border px-3 py-1 font-[family-name:var(--font-space-grotesk)] text-[11px] font-medium transition-colors',
              tab === t.id
                ? 'border-foreground/20 bg-foreground/10 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'skills' && <SkillsTab />}
      {tab === 'authority' && <AuthorityTab />}
    </div>
  )
}
