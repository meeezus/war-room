import { createServiceClient } from '@/lib/supabase-server'
import { Breadcrumb } from '@/components/breadcrumb'
import Link from 'next/link'
import type { Objective } from '@/lib/types'

async function getObjectives(): Promise<Objective[]> {
  const sb = createServiceClient()
  if (!sb) return []
  const { data, error } = await sb
    .from('objectives')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) { console.error('getObjectives error:', error); return [] }
  return (data ?? []) as Objective[]
}

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
  })
}

export default async function ObjectivesPage() {
  const objectives = await getObjectives()

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
          <div>
            <Breadcrumb segments={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Objectives' },
            ]} className="mb-4" />
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground">
              Objectives
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              High-level goals with success criteria
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/objectives/new"
              className="px-3 py-1.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
            >
              + Objective
            </Link>
            <div className="text-right">
              <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-foreground">
                {objectives.length}
              </div>
              <div className="text-xs text-muted-foreground">objectives</div>
            </div>
          </div>
        </div>

        {/* Objectives list */}
        {objectives.length === 0 ? (
          <div className="rounded-sm border border-border bg-card/50 p-12 text-center">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-foreground mb-2">
              No objectives yet
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
              Objectives are high-level goals with success criteria and iteration caps.
            </p>
            <Link
              href="/objectives/new"
              className="px-4 py-2 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors inline-block"
            >
              Create your first objective
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {objectives.map((obj) => {
              const pct = Math.min(100, Math.round((obj.iteration_count / obj.max_iterations) * 100))
              return (
                <Link
                  key={obj.id}
                  href={`/objectives/${obj.id}`}
                  className="block rounded-sm border border-border bg-card backdrop-blur-xl p-4 transition-colors hover:border-border/80 hover:bg-card/80"
                >
                  {/* Top row: title + status */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-[family-name:var(--font-space-grotesk)] text-base font-semibold text-foreground leading-snug">
                      {obj.title}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_COLORS[obj.status]}`}>
                      {obj.status}
                    </span>
                  </div>

                  {/* Success criteria */}
                  {obj.success_criteria && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2 mb-3">
                      {obj.success_criteria}
                    </p>
                  )}

                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-1.5 rounded-full bg-muted w-24 sm:w-32 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
                      {obj.iteration_count}/{obj.max_iterations} iterations
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 flex-wrap">
                    {obj.project_id && (
                      <span className="text-[10px] text-muted-foreground/75">
                        Project: {obj.project_id.slice(0, 8)}…
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/75">
                      by {obj.created_by}
                    </span>
                    <span className="text-[10px] text-muted-foreground/75 ml-auto">
                      {formatDate(obj.created_at)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
