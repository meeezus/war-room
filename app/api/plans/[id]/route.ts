import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { captureError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

const ALLOWED_PATCH_FIELDS = new Set([
  'status',
  'auto_run',
  'raw_markdown',
  'parsed_beads',
  'analysis',
])

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const sb = createServiceClient()
    if (!sb) {
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 500 }
      )
    }

    const { data, error } = await sb
      .from('plans')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ plan: data })
  } catch (err) {
    captureError(err, 'plans/[id].GET')
    return NextResponse.json(
      { error: 'Failed to fetch plan' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Whitelist allowed fields
    const updates: Record<string, unknown> = {}
    for (const key of Object.keys(body)) {
      if (ALLOWED_PATCH_FIELDS.has(key)) {
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update. Allowed: status, auto_run, raw_markdown, parsed_beads, analysis' },
        { status: 400 }
      )
    }

    const sb = createServiceClient()
    if (!sb) {
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 500 }
      )
    }

    const { data, error } = await sb
      .from('plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      captureError(error, 'plans/[id].PATCH', { planId: id })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plan: data })
  } catch (err) {
    captureError(err, 'plans/[id].PATCH')
    return NextResponse.json(
      { error: 'Failed to update plan' },
      { status: 500 }
    )
  }
}
