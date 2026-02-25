import { createServiceClient } from '@/lib/supabase-server'
import { CouncilSessionList } from '@/components/council/council-session-list'
import { Breadcrumb } from '@/components/breadcrumb'
import type { CouncilSession } from '@/lib/types'

async function getSessions(): Promise<CouncilSession[]> {
  const sb = createServiceClient()
  if (!sb) return []
  const { data, error } = await sb
    .from('council_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) { console.error('getSessions error:', error); return [] }
  return (data ?? []) as CouncilSession[]
}

export default async function CouncilPage() {
  const sessions = await getSessions()

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Breadcrumb segments={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Council" }
            ]} className="mb-4" />
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground">
              Shogunate Council
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Strategic reviews by the Daimyo council
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-foreground">
              {sessions.length}
            </div>
            <div className="text-xs text-muted-foreground">sessions</div>
          </div>
        </div>

        {/* Sessions list */}
        {sessions.length === 0 ? (
          <div className="rounded-sm border border-border bg-card/50 p-12 text-center">
            <div className="text-3xl mb-3">&#x2694;&#xFE0F;</div>
            <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-foreground mb-2">
              No council sessions yet
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Run <code className="font-[family-name:var(--font-jetbrains-mono)] text-foreground/60">/council</code> in Claude Code to convene the Daimyo council and post results here.
            </p>
          </div>
        ) : (
          <CouncilSessionList sessions={sessions} />
        )}
      </div>
    </div>
  )
}
