import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const sb = createServiceClient()
  if (!sb) return Response.json({ error: 'Service unavailable' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const severity = searchParams.get('severity')  // comma-separated: "critical,warning"
  const repo = searchParams.get('repo')

  try {
    let query = sb.from('discoveries').select('*').order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (severity) {
      const severities = severity.split(',').map(s => s.trim())
      query = query.in('severity', severities)
    }
    if (repo) query = query.eq('repo', repo)

    const { data, error } = await query.limit(100)
    if (error) throw error

    return Response.json({ discoveries: data ?? [] })
  } catch (err) {
    console.error('[discoveries] Error:', err)
    return Response.json({ error: 'Failed to fetch discoveries' }, { status: 500 })
  }
}
