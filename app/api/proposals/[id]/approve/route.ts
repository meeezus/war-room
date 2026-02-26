import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service client unavailable' }, { status: 500 })
  }

  const { error } = await supabase
    .from('proposals')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'sensei',
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to approve proposal' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
