import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

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
