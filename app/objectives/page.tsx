import { createServiceClient } from '@/lib/supabase-server'
import { Breadcrumb } from '@/components/breadcrumb'
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
    <div className="min-h-screen bg-[#050505] text-[#E5E5E5] p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Breadcrumb segments={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Objectives' },
            ]} className="mb-4" />
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-[#E5E5E5]">
              Objectives
            </h1>
            <p className="mt-1 text-sm text-[rgba(255,255,255,0.4)]">
              High-level goals with success criteria
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-[#E5E5E5]">
              {objectives.length}
            </div>
            <div className="text-xs text-[rgba(255,255,255,0.4)]">objectives</div>
          </div>
        </div>

        {/* Objectives list */}
        {objectives.length === 0 ? (
          <div className="rounded-sm border border-white/[0.06] bg-[rgba(10,10,10,0.5)] p-12 text-center">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-[#E5E5E5] mb-2">
              No objectives yet
            </h3>
            <p className="text-xs text-[rgba(255,255,255,0.4)] max-w-xs mx-auto">
              Create an objective in Shoin Chat to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {objectives.map((obj) => {
              const pct = Math.min(100, Math.round((obj.iteration_count / obj.max_iterations) * 100))
              return (
                <div
                  key={obj.id}
                  className="rounded-sm border border-white/[0.08] bg-[rgba(10,10,10,0.8)] backdrop-blur-xl p-4"
                >
                  {/* Top row: title + status */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-[family-name:var(--font-space-grotesk)] text-base font-semibold text-[#E5E5E5] leading-snug">
                      {obj.title}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_COLORS[obj.status]}`}>
                      {obj.status}
                    </span>
                  </div>

                  {/* Success criteria */}
                  {obj.success_criteria && (
                    <p className="text-xs text-[rgba(255,255,255,0.5)] italic line-clamp-2 mb-3">
                      {obj.success_criteria}
                    </p>
                  )}

                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-1.5 rounded-full bg-white/[0.06] w-32 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[rgba(255,255,255,0.4)]">
                      {obj.iteration_count}/{obj.max_iterations} iterations
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 flex-wrap">
                    {obj.project_id && (
                      <span className="text-[10px] text-[rgba(255,255,255,0.3)]">
                        Project: {obj.project_id.slice(0, 8)}…
                      </span>
                    )}
                    <span className="text-[10px] text-[rgba(255,255,255,0.3)]">
                      by {obj.created_by}
                    </span>
                    <span className="text-[10px] text-[rgba(255,255,255,0.3)] ml-auto">
                      {formatDate(obj.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
