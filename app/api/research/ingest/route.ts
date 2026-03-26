import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { source, title, summary, url, relevance, tags, metadata } = body

    if (!source || !title) {
      return NextResponse.json({ error: 'source and title required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }

    const { data, error } = await supabase
      .from('research_findings')
      .insert({
        source,
        title,
        summary: summary || null,
        url: url || null,
        relevance: relevance || 'medium',
        tags: tags || [],
        metadata: metadata || {},
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ finding: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
