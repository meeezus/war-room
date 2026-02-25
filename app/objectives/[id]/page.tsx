import { createServiceClient } from '@/lib/supabase-server'
import { Breadcrumb } from '@/components/breadcrumb'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Objective } from '@/lib/types'

const STATUS_COLORS: Record<Objective['status'], string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  paused: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
  capped: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface Mission {
  id: string
  title: string
  status: string
  assigned_to: string | null
  created_at: string
}

interface Proposal {
  id: string
  title: string
  status: string
  source: string | null
  created_at: string
}

export default async function ObjectiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) return notFound()

  const { data: obj, error } = await sb
    .from('objectives')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !obj) return notFound()

  const objective = obj as Objective

  // Fetch related missions and proposals
  const [missionsRes, proposalsRes] = await Promise.all([
    sb.from('missions').select('id,title,status,assigned_to,created_at').eq('objective_id', id).order('created_at', { ascending: false }).limit(20),
    sb.from('proposals').select('id,title,status,source,created_at').eq('objective_id', id).order('created_at', { ascending: false }).limit(20),
  ])

  const missions = (missionsRes.data ?? []) as Mission[]
  const proposals = (proposalsRes.data ?? []) as Proposal[]

  const pct = Math.min(100, Math.round((objective.iteration_count / objective.max_iterations) * 100))

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Breadcrumb segments={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Objectives', href: '/objectives' },
          { label: objective.title },
        ]} className="mb-6" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground leading-snug">
            {objective.title}
          </h1>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${STATUS_COLORS[objective.status]}`}>
            {objective.status}
          </span>
        </div>

        {/* Details card */}
        <div className="rounded-sm border border-border bg-card p-5 mb-6">
          {objective.description && (
            <p className="text-sm text-muted-foreground mb-4">{objective.description}</p>
          )}

          <div className="mb-4">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-[family-name:var(--font-space-grotesk)]">
              Success Criteria
            </span>
            <p className="text-sm text-foreground mt-1">{objective.success_criteria}</p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-2 rounded-full bg-muted flex-1 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground shrink-0">
              {objective.iteration_count}/{objective.max_iterations} iterations ({pct}%)
            </span>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground/75">
            <div>
              <span className="text-muted-foreground/50">Created by:</span>{' '}
              {objective.created_by}
            </div>
            <div>
              <span className="text-muted-foreground/50">Created:</span>{' '}
              {formatDate(objective.created_at)}
            </div>
            {objective.max_cost_usd && (
              <div>
                <span className="text-muted-foreground/50">Budget:</span>{' '}
                ${objective.max_cost_usd}
              </div>
            )}
            {objective.project_id && (
              <div>
                <span className="text-muted-foreground/50">Project:</span>{' '}
                <Link href={`/projects/${objective.project_id}`} className="text-blue-400 hover:text-blue-300">
                  {objective.project_id.slice(0, 8)}...
                </Link>
              </div>
            )}
            {objective.completed_at && (
              <div>
                <span className="text-muted-foreground/50">Completed:</span>{' '}
                {formatDate(objective.completed_at)}
              </div>
            )}
          </div>
        </div>

        {/* Missions */}
        <div className="mb-6">
          <h2 className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Missions ({missions.length})
          </h2>
          {missions.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">No missions yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {missions.map((m) => (
                <Link
                  key={m.id}
                  href={`/missions`}
                  className="block rounded-sm border border-border bg-card/50 p-3 transition-colors hover:bg-card/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground font-medium truncate">{m.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                      {m.status}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground/60">
                    {m.assigned_to && <span>{m.assigned_to}</span>}
                    <span>{formatDate(m.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Proposals */}
        <div>
          <h2 className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Proposals ({proposals.length})
          </h2>
          {proposals.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">No proposals yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {proposals.map((p) => (
                <div
                  key={p.id}
                  className="rounded-sm border border-border bg-card/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground font-medium truncate">{p.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                      {p.status}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground/60">
                    {p.source && <span>{p.source}</span>}
                    <span>{formatDate(p.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
