import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'

export const runtime = 'nodejs'

const execFileAsync = promisify(execFile)
const startTime = Date.now()

async function checkSupabase(): Promise<boolean> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return false
    const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error } = await sb.from('projects').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}

async function checkClaudeCli(): Promise<boolean> {
  const paths = ['/opt/homebrew/bin/claude', '/usr/local/bin/claude']
  for (const p of paths) {
    try {
      await execFileAsync(p, ['--version'], { timeout: 5000 })
      return true
    } catch {
      continue
    }
  }
  return false
}

async function checkPoller(): Promise<{ alive: boolean; last_heartbeat: string | null }> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { alive: false, last_heartbeat: null }
    const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data } = await sb
      .from('events')
      .select('created_at')
      .eq('type', 'heartbeat')
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return {
      alive: !!data,
      last_heartbeat: data?.created_at ?? null,
    }
  } catch {
    return { alive: false, last_heartbeat: null }
  }
}

export async function GET() {
  const [supabase, claude_cli, poller] = await Promise.all([
    checkSupabase(),
    checkClaudeCli(),
    checkPoller(),
  ])

  const status = supabase && claude_cli && poller.alive ? 'ok' : 'degraded'

  return NextResponse.json(
    {
      status,
      checks: { supabase, claude_cli, poller },
      uptime_ms: Date.now() - startTime,
    },
    { status: 200 }
  )
}
