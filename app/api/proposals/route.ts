import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { captureError } from '@/lib/sentry'

export async function POST(req: NextRequest) {
  try {
    const { title, description, domain, project_id, objective_id } =
      await req.json()

    if (!title || !description) {
      return NextResponse.json(
        { error: 'title and description are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Service client unavailable' },
        { status: 500 }
      )
    }

    const { data, error } = await supabase
      .from('proposals')
      .insert({
        title,
        description,
        source: 'shoin_chat',
        requested_by: 'sensei',
        domain: domain || null,
        project_id: project_id || null,
        objective_id: objective_id || null,
        status: 'pending',
        auto_approved: false,
        council_review: false,
        reviews: [],
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ proposal: data })
  } catch (err) {
    captureError(err, 'proposals.POST')
    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    )
  }
}
