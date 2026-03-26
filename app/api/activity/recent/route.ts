import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { execFile } from 'child_process'
import { supabase } from '@/lib/supabase'
import type { ActivityItem, ActivityFeedResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

const HOME = process.env.HOME || '/Users/michaelenriquez'

function isVercel() {
  return !!process.env.VERCEL
}

// ---------------------------------------------------------------------------
// Source: Spark cognitive insights (local only)
// ---------------------------------------------------------------------------
async function getSparkItems(): Promise<ActivityItem[]> {
  if (isVercel()) return []
  try {
    const raw = await readFile(`${HOME}/.spark/cognitive_insights.json`, 'utf-8')
    const insights = JSON.parse(raw)
    if (!Array.isArray(insights)) return []
    return insights.slice(-10).reverse().map((ins: Record<string, unknown>) => ({
      source: 'spark' as const,
      type: 'insight',
      title: typeof ins.content === 'string' ? ins.content.slice(0, 120) : 'Spark insight',
      detail: typeof ins.When === 'string' ? ins.When : null,
      timestamp: typeof ins.created_at === 'string'
        ? ins.created_at
        : new Date().toISOString(),
    }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Source: Tab-ledger sessions (local only, via sqlite3 CLI)
// ---------------------------------------------------------------------------
async function getTabLedgerItems(): Promise<ActivityItem[]> {
  if (isVercel()) return []
  try {
    const dbPath = `${HOME}/.tab-ledger/ledger.db`
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        'sqlite3',
        [dbPath, "SELECT session_id || '|' || coalesce(project,'') || '|' || started_at || '|' || coalesce(printf('%.2f',cost_usd),'0') FROM cc_sessions ORDER BY started_at DESC LIMIT 5;"],
        { timeout: 5000 },
        (err, out) => {
          if (err) reject(err)
          else resolve(typeof out === 'string' ? out.trim() : String(out).trim())
        },
      )
    })
    if (!stdout) return []
    return stdout.split('\n').filter(Boolean).map(line => {
      const [sessionId, project, startedAt, cost] = line.split('|')
      return {
        source: 'tab_ledger' as const,
        type: 'session',
        title: project ? `Session: ${project}` : `Session ${sessionId?.slice(0, 8)}`,
        detail: cost ? `$${cost}` : null,
        timestamp: startedAt || new Date().toISOString(),
      }
    })
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Source: Supabase war_room_events (works on Vercel + local)
// ---------------------------------------------------------------------------
async function getEngineItems(): Promise<ActivityItem[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('war_room_events')
      .select('id, event_type, title, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error || !data) return []

    return data.map((row: { id: string; event_type: string; title: string; created_at: string }) => ({
      source: 'engine' as const,
      type: row.event_type,
      title: row.title,
      detail: null,
      timestamp: row.created_at,
    }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const [sparkItems, tabLedgerItems, engineItems] = await Promise.all([
      getSparkItems(),
      getTabLedgerItems(),
      getEngineItems(),
    ])

    const all = [...sparkItems, ...tabLedgerItems, ...engineItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20)

    const body: ActivityFeedResponse = {
      isLocal: !isVercel(),
      items: all,
    }

    return NextResponse.json(body)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
