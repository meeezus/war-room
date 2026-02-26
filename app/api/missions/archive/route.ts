import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST() {
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  // 1. Get IDs of all failed missions
  const { data: failedMissions, error: fetchError } = await sb
    .from('missions')
    .select('id')
    .eq('status', 'failed')

  if (fetchError) {
    console.error('[missions/archive] fetch failed missions error:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch failed missions' }, { status: 500 })
  }

  const ids = failedMissions?.map((m) => m.id) ?? []
  if (ids.length === 0) {
    return NextResponse.json({ deleted: 0 }, { status: 200 })
  }

  // 2. Clean up related records (no cascade deletes on these FKs)
  const cleanups = [
    sb.from('tasks').delete().in('mission_id', ids),
    sb.from('active_agents').delete().in('mission_id', ids),
    sb.from('skill_patches').delete().in('mission_id', ids),
    sb.from('agent_memory').update({ source_mission_id: null }).in('source_mission_id', ids),
    sb.from('proposals').update({ parent_mission_id: null }).in('parent_mission_id', ids),
  ]

  const results = await Promise.all(cleanups)
  for (const { error: cleanupErr } of results) {
    if (cleanupErr) {
      console.error('[missions/archive] cleanup error:', cleanupErr)
      // Continue — best effort cleanup, mission delete may still succeed
    }
  }

  // 3. Delete the failed missions
  const { error: deleteError } = await sb
    .from('missions')
    .delete()
    .in('id', ids)

  if (deleteError) {
    console.error('[missions/archive] delete error:', deleteError)
    return NextResponse.json({ error: 'Failed to delete failed missions' }, { status: 500 })
  }

  return NextResponse.json({ deleted: ids.length }, { status: 200 })
}
