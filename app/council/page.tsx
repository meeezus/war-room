import { createServiceClient } from '@/lib/supabase-server'
import { CouncilSessionCard } from '@/components/council/council-session-card'
import Link from 'next/link'
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
    <div className="min-h-screen bg-[#050505] text-[#E5E5E5] p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2">
              <Link
                href="/dashboard"
                className="text-xs text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.7)] transition-colors"
              >
                ← Dashboard
              </Link>
            </div>
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-[#E5E5E5]">
              Shogunate Council
            </h1>
            <p className="mt-1 text-sm text-[rgba(255,255,255,0.4)]">
              Strategic reviews by the Daimyo council
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-[#E5E5E5]">
              {sessions.length}
            </div>
            <div className="text-xs text-[rgba(255,255,255,0.4)]">sessions</div>
          </div>
        </div>

        {/* Sessions list */}
        {sessions.length === 0 ? (
          <div className="rounded-sm border border-white/[0.06] bg-[rgba(10,10,10,0.5)] p-12 text-center">
            <div className="text-3xl mb-3">⚔️</div>
            <h3 className="font-[family-name:var(--font-space-grotesk)] font-semibold text-sm text-[#E5E5E5] mb-2">
              No council sessions yet
            </h3>
            <p className="text-xs text-[rgba(255,255,255,0.4)] max-w-xs mx-auto">
              Run <code className="font-[family-name:var(--font-jetbrains-mono)] text-[rgba(255,255,255,0.6)]">/council</code> in Claude Code to convene the Daimyo council and post results here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
              <CouncilSessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
