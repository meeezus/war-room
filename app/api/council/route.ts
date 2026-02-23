import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getCouncilSessions } from '@/lib/queries'
import type { CouncilReview } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status')
  const status =
    statusParam === 'active' || statusParam === 'archived' ? statusParam : 'active'

  const sessions = await getCouncilSessions(20, { status })
  return Response.json({ sessions })
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const expectedKey = process.env.WAR_ROOM_API_KEY
  if (expectedKey && apiKey !== expectedKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()
  if (!sb) return Response.json({ error: 'Service unavailable' }, { status: 500 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { topic, council_type, reviews, synthesis, recommendation, dissent, source, metadata } =
    body as Record<string, unknown>

  if (!topic || typeof topic !== 'string') {
    return Response.json({ error: 'topic is required' }, { status: 400 })
  }
  if (!Array.isArray(reviews)) {
    return Response.json({ error: 'reviews must be an array' }, { status: 400 })
  }
  for (const r of reviews as CouncilReview[]) {
    if (!r.name || !r.voice_text) {
      return Response.json(
        { error: 'each review must have name and voice_text' },
        { status: 400 }
      )
    }
  }

  const { data, error } = await sb
    .from('council_sessions')
    .insert({
      topic,
      council_type: council_type ?? 'full',
      reviews,
      synthesis: synthesis ?? null,
      recommendation: recommendation ?? null,
      dissent: dissent ?? null,
      source: source ?? 'claude_code',
      metadata: metadata ?? {},
    })
    .select()
    .single()

  if (error) {
    console.error('[council/route] POST error:', error)
    return Response.json({ error: 'Failed to create session' }, { status: 500 })
  }
  return Response.json({ session: data }, { status: 201 })
}
