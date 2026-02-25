import { createServiceClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) return NextResponse.json({ error: 'No DB' }, { status: 500 })

  const { data, error } = await sb
    .from('objectives')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ objective: data })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) return NextResponse.json({ error: 'No DB' }, { status: 500 })

  const body = await request.json()
  // Allow updating: status, title, description, success_criteria
  const allowed = ['status', 'title', 'description', 'success_criteria']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { error } = await sb
    .from('objectives')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) return NextResponse.json({ error: 'No DB' }, { status: 500 })

  const { error } = await sb
    .from('objectives')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
