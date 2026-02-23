import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/events - List recent events
 * POST /api/events - Create an event (for hooks/agents)
 */

export async function GET() {
  if (!supabase) {
    return Response.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('created_at', threeDaysAgo)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[events] GET error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ events: data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, source_id, agent, message, metadata } = body as {
      type: string
      source_id?: string
      agent?: string
      message: string
      metadata?: Record<string, unknown>
    }

    if (!type || !message) {
      return Response.json({ error: 'type and message are required' }, { status: 400 })
    }

    const sb = createServiceClient()
    if (!sb) {
      return Response.json({ error: 'Service unavailable' }, { status: 503 })
    }

    const { data, error } = await sb
      .from('events')
      .insert({
        type,
        source_id: source_id ?? null,
        agent: agent ?? 'cc',
        message,
        metadata: metadata ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('[events] POST error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ event: data })
  } catch (err) {
    console.error('[events] Error:', err)
    return Response.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
