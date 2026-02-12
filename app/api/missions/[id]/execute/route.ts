import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  // Verify mission exists and is queued
  const { data: mission, error } = await sb
    .from('missions')
    .select('id, status, assigned_to')
    .eq('id', id)
    .single()

  if (error || !mission) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 })
  }

  if (mission.status !== 'queued') {
    return NextResponse.json(
      { error: `Mission not in queued state (current: ${mission.status})` },
      { status: 409 }
    )
  }

  // Update mission status
  const now = new Date().toISOString()
  await sb.from('missions').update({
    status: 'running',
    started_at: now,
  }).eq('id', id)

  // Update agent status to busy
  await sb.from('agent_status').update({
    status: 'busy',
    current_mission_id: id,
    last_heartbeat: now,
  }).eq('id', mission.assigned_to)

  // Spawn engine executor as detached background process
  const engineDir = process.env.SHOGUNATE_ENGINE_DIR || `${process.env.HOME}/Code/war-room`
  // Sanitize id to prevent command injection (only allow UUID chars)
  const safeId = id.replace(/[^a-zA-Z0-9-]/g, '')
  exec(
    `cd "${engineDir}" && uv run python -c "from engine.executor import execute_mission; execute_mission('${safeId}')"`,
    { timeout: 1800000 }, // 30 min timeout
    (error, stdout, stderr) => {
      if (error) console.error(`Execute mission ${id} error:`, error.message)
      if (stdout) console.log(`Execute mission ${id}:`, stdout.trim())
      if (stderr) console.error(`Execute mission ${id} stderr:`, stderr)
    }
  )

  return NextResponse.json({ started: true, missionId: id })
}
