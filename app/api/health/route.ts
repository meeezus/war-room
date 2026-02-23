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
  try {
    await execFileAsync('/opt/homebrew/bin/claude', ['--version'], { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const [supabase, claude_cli] = await Promise.all([checkSupabase(), checkClaudeCli()])

  const status = supabase && claude_cli ? 'ok' : 'degraded'

  return NextResponse.json(
    {
      status,
      checks: { supabase, claude_cli },
      uptime_ms: Date.now() - startTime,
    },
    { status: status === 'ok' ? 200 : 503 }
  )
}
