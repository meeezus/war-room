import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { generateBriefHtml } from '@/lib/brief-generator'
import type { Discovery, Mission, Event } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Service client unavailable' }, { status: 500 })
  }

  try {
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

    // Fetch in parallel
    const [discoveriesRes, missionsRes, eventsRes] = await Promise.all([
      sb.from('discoveries').select('*').order('severity', { ascending: true }).order('created_at', { ascending: false }),
      sb.from('missions').select('*').gte('created_at', cutoff),
      sb.from('events').select('*').gte('created_at', cutoff).order('created_at', { ascending: false }).limit(200),
    ])

    if (discoveriesRes.error) throw discoveriesRes.error
    if (missionsRes.error) throw missionsRes.error
    if (eventsRes.error) throw eventsRes.error

    const discoveries = (discoveriesRes.data ?? []) as Discovery[]
    const missions = (missionsRes.data ?? []) as Mission[]
    const events = (eventsRes.data ?? []) as Event[]

    const generatedAt = new Date().toISOString()
    const pendingCount = discoveries.filter(d => d.status === 'pending').length

    // Action URL is relative — brief is rendered inside war-room context
    const actionUrl = '/api/brief/action'

    const html = generateBriefHtml({ discoveries, missions, events, generatedAt, actionUrl })

    return NextResponse.json({
      html,
      generated_at: generatedAt,
      discovery_count: pendingCount,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
