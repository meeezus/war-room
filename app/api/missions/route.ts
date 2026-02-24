import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  const body = await req.json()
  const { title, project_id, assigned_to, proposal_id } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('missions')
    .insert({
      title,
      project_id: project_id ?? null,
      proposal_id: proposal_id ?? null,
      assigned_to: assigned_to ?? 'cc',
      status: 'queued',
    })
    .select()
    .single()

  if (error) {
    console.error('[missions/route] POST error:', error)
    return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 })
  }

  return NextResponse.json({ mission: data }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const project_id = searchParams.get('project_id')

  let query = sb
    .from('missions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (status) {
    query = query.eq('status', status)
  }
  if (project_id) {
    query = query.eq('project_id', project_id)
  }

  const { data, error } = await query

  if (error) {
    console.error('[missions/route] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 })
  }

  return NextResponse.json({ missions: data })
}
