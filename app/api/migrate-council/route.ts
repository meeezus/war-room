import { createServiceClient } from '@/lib/supabase-server'

export async function GET() {
  const sb = createServiceClient()
  if (!sb) return Response.json({ error: 'no client' }, { status: 500 })

  const sql = `
    CREATE TABLE IF NOT EXISTS council_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic TEXT NOT NULL,
      council_type TEXT DEFAULT 'full',
      reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
      synthesis TEXT,
      recommendation TEXT,
      dissent TEXT,
      source TEXT DEFAULT 'claude_code',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_council_sessions_created ON council_sessions (created_at DESC);
  `

  let error: string | null = null
  try {
    const result = await sb.rpc('exec_sql', { query: sql })
    error = result.error ? String(result.error) : null
  } catch {
    error = 'rpc_unavailable'
  }

  if (error === 'rpc_unavailable') {
    // Try direct insert to force table existence check
    const { error: e2 } = await sb.from('council_sessions').select('id').limit(1)
    if (e2) return Response.json({ error: e2.message, hint: 'Apply migration manually in Supabase SQL editor' }, { status: 500 })
    return Response.json({ ok: true, note: 'table already exists' })
  }

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json({ ok: true, message: 'council_sessions table created' })
}
