import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase-server'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@war-room.dev'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

interface PushPayload {
  title: string
  body: string
  url?: string
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('VAPID not configured')
    return { sent: 0, failed: 0 }
  }

  const sb = createServiceClient()
  if (!sb) return { sent: 0, failed: 0 }

  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return { sent: 0, failed: 0 }

  return sendToSubscriptions(subs, payload)
}

export async function sendPushBroadcast(
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sent: 0, failed: 0 }
  }

  const sb = createServiceClient()
  if (!sb) return { sent: 0, failed: 0 }

  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (!subs?.length) return { sent: 0, failed: 0 }

  return sendToSubscriptions(subs, payload)
}

async function sendToSubscriptions(
  subs: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/chat',
  })

  let sent = 0, failed = 0

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      )
      sent++
    } catch (e: any) {
      failed++
      if (e.statusCode === 410) {
        console.log('Subscription expired:', sub.endpoint.slice(0, 40))
      }
    }
  }))

  return { sent, failed }
}
