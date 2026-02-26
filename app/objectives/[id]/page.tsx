import { createServiceClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import type { Objective, Mission, Proposal } from '@/lib/types'
import { ObjectiveDetailClient } from './objective-detail-client'

export default async function ObjectiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) return notFound()

  // Fetch objective + related entities in parallel
  const [objectiveRes, missionsRes, proposalsRes] = await Promise.all([
    sb.from('objectives').select('*').eq('id', id).single(),
    sb.from('missions').select('*').eq('objective_id', id).order('created_at', { ascending: false }).limit(50),
    sb.from('proposals').select('*').eq('objective_id', id).order('created_at', { ascending: false }).limit(50),
  ])

  if (objectiveRes.error || !objectiveRes.data) return notFound()

  const objective = objectiveRes.data as Objective
  const missions = (missionsRes.data ?? []) as Mission[]
  const proposals = (proposalsRes.data ?? []) as Proposal[]

  return (
    <ObjectiveDetailClient
      objective={objective}
      missions={missions}
      proposals={proposals}
    />
  )
}
