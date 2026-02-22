import { createServiceClient } from '@/lib/supabase-server'
import { CouncilCard } from '@/components/council/council-card'
import { CouncilSynthesis } from '@/components/council/council-synthesis'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CouncilSession } from '@/lib/types'

async function getSession(id: string): Promise<CouncilSession | null> {
  const sb = createServiceClient()
  if (!sb) return null
  const { data, error } = await sb
    .from('council_sessions')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as CouncilSession
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const COUNCIL_TYPE_LABELS: Record<string, string> = {
  full: 'Full Council',
  technical: 'Technical Review',
  business: 'Business Review',
  security: 'Security Review',
}

export default async function CouncilSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession(id)
  if (!session) notFound()

  const typeLabel = COUNCIL_TYPE_LABELS[session.council_type] ?? session.council_type

  return (
    <div className="min-h-screen bg-[#050505] text-[#E5E5E5] p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        {/* Nav */}
        <div className="mb-8">
          <Link
            href="/council"
            className="text-xs text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.7)] transition-colors"
          >
            ← Council Sessions
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-white/[0.08] text-[rgba(255,255,255,0.5)]">
              {typeLabel}
            </span>
            <span className="text-[10px] text-[rgba(255,255,255,0.3)]">
              {formatDate(session.created_at)}
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl md:text-3xl font-bold text-[#E5E5E5] leading-tight">
            {session.topic}
          </h1>
          <p className="mt-2 text-sm text-[rgba(255,255,255,0.4)]">
            {session.reviews.length} council members · {session.source}
          </p>
        </div>

        {/* Daimyo grid */}
        {session.reviews.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {session.reviews.map((review, i) => (
              <CouncilCard key={i} review={review} />
            ))}
          </div>
        )}

        {/* Makima synthesis */}
        {(session.synthesis || session.recommendation) && (
          <CouncilSynthesis session={session} />
        )}
      </div>
    </div>
  )
}
