import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { captureError } from '@/lib/sentry'

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Service client unavailable' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ proposals: data ?? [] })
  } catch (err) {
    captureError(err, 'proposals/list.GET')
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    )
  }
}
