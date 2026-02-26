import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST() {
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  const { data, error } = await sb
    .from('missions')
    .update({ status: 'archived' })
    .eq('status', 'failed')
    .select('id')

  if (error) {
    console.error('[missions/archive] POST error:', error)
    return NextResponse.json({ error: 'Failed to archive missions' }, { status: 500 })
  }

  const archived = data?.length ?? 0
  return NextResponse.json({ archived }, { status: 200 })
}
