import { NextRequest, NextResponse } from 'next/server'
import { sendPushBroadcast, sendPushToUser } from '@/lib/push-notifications-server'

export async function POST(req: NextRequest) {
  const { title, body, url, userId } = await req.json()

  if (!title || !body) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 })
  }

  const result = userId
    ? await sendPushToUser(userId, { title, body, url })
    : await sendPushBroadcast({ title, body, url })

  return NextResponse.json(result)
}
