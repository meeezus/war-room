import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const body = await request.json()
  const { title, description, domain, projectId, source, requestedBy, riskLevel, costEstimate, timeEstimate } = body

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service client unavailable' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      title,
      description: description || null,
      domain: domain || null,
      project_id: projectId || null,
      source: source || 'manual',
      requested_by: requestedBy || 'sensei',
      risk_level: riskLevel || 'low',
      cost_estimate: costEstimate || null,
      time_estimate: timeEstimate || null,
      status: 'pending',
      auto_approved: false,
      council_review: false,
      reviews: [],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
