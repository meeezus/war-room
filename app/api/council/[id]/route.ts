import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { archiveCouncilSession, deleteCouncilSession } from '@/lib/queries'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) return Response.json({ error: 'Service unavailable' }, { status: 500 })

  const { data, error } = await sb
    .from('council_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }
  return Response.json({ session: data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) return Response.json({ error: 'Service unavailable' }, { status: 500 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status } = body as Record<string, unknown>
  if (status !== 'active' && status !== 'resolved' && status !== 'archived') {
    return Response.json({ error: 'status must be active, resolved, or archived' }, { status: 400 })
  }

  if (status === 'archived') {
    const ok = await archiveCouncilSession(id)
    if (!ok) return Response.json({ error: 'Failed to archive session' }, { status: 500 })
  } else {
    const { error } = await sb
      .from('council_sessions')
      .update({ status: status as string })
      .eq('id', id)
    if (error) return Response.json({ error: 'Failed to update session' }, { status: 500 })
  }

  return Response.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ok = await deleteCouncilSession(id)
  if (!ok) return Response.json({ error: 'Failed to delete session' }, { status: 500 })
  return Response.json({ success: true })
}
