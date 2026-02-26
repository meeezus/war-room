import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const sb = createServiceClient()
  const { endpoint, keys } = await req.json()

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const { error } = await sb!
    .from('push_subscriptions')
    .upsert({
      user_id: 'sensei',
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'user_id,endpoint' })

  if (error) {
    console.error('Push subscription error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const sb = createServiceClient()
  const { endpoint } = await req.json()

  await sb!
    .from('push_subscriptions')
    .delete()
    .eq('user_id', 'sensei')
    .eq('endpoint', endpoint)

  return NextResponse.json({ success: true })
}
