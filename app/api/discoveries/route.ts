import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { captureError } from '@/lib/sentry'

export async function GET(req: NextRequest) {
  const sb = createServiceClient()
  if (!sb) return Response.json({ error: 'Service unavailable' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const severity = searchParams.get('severity')  // comma-separated: "critical,warning"
  const repo = searchParams.get('repo')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)
  const offset = (page - 1) * limit

  try {
    // Count query for pagination
    let countQuery = sb.from('discoveries').select('*', { count: 'exact', head: true })
    // Data query
    let dataQuery = sb.from('discoveries').select('*').order('created_at', { ascending: false })

    if (status) {
      countQuery = countQuery.eq('status', status)
      dataQuery = dataQuery.eq('status', status)
    }
    if (severity) {
      const severities = severity.split(',').map(s => s.trim())
      countQuery = countQuery.in('severity', severities)
      dataQuery = dataQuery.in('severity', severities)
    }
    if (repo && repo !== 'all') {
      countQuery = countQuery.eq('repo', repo)
      dataQuery = dataQuery.eq('repo', repo)
    }
    if (search) {
      const ilike = `%${search}%`
      countQuery = countQuery.ilike('title', ilike)
      dataQuery = dataQuery.ilike('title', ilike)
    }

    const [{ count, error: countErr }, { data, error: dataErr }] = await Promise.all([
      countQuery,
      dataQuery.range(offset, offset + limit - 1),
    ])

    if (countErr) throw countErr
    if (dataErr) throw dataErr

    return Response.json({
      discoveries: data ?? [],
      total: count ?? 0,
      page,
      limit,
    })
  } catch (err) {
    captureError(err, 'discoveries.GET')
    return Response.json({ error: 'Failed to fetch discoveries' }, { status: 500 })
  }
}

// Separate endpoint to get repos with severity counts for sidebar
export async function POST(req: NextRequest) {
  const sb = createServiceClient()
  if (!sb) return Response.json({ error: 'Service unavailable' }, { status: 503 })

  try {
    const body = await req.json().catch(() => ({}))
    const status = body.status ?? 'pending'

    const { data, error } = await sb
      .from('discoveries')
      .select('repo, severity')
      .eq('status', status)
      .not('repo', 'is', null)

    if (error) throw error

    // Group by repo, count per severity
    const repoMap: Record<string, { critical: number; warning: number; info: number }> = {}
    for (const row of data ?? []) {
      const r = row.repo as string
      if (!repoMap[r]) repoMap[r] = { critical: 0, warning: 0, info: 0 }
      const sev = row.severity as 'critical' | 'warning' | 'info'
      if (sev in repoMap[r]) repoMap[r][sev]++
    }

    const repos = Object.entries(repoMap)
      .map(([repo, counts]) => ({ repo, ...counts, total: counts.critical + counts.warning + counts.info }))
      .sort((a, b) => b.total - a.total)

    return Response.json({ repos })
  } catch (err) {
    captureError(err, 'discoveries/repos.POST')
    return Response.json({ error: 'Failed to fetch repos' }, { status: 500 })
  }
}
