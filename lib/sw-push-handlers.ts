/**
 * Service Worker push notification handler logic.
 *
 * Extracted from sw.ts so the core logic can be unit-tested
 * outside the ServiceWorkerGlobalScope. The sw.ts file wires
 * these functions into the actual event listeners.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushPayload {
  title?: string
  body?: string
  url?: string
  [key: string]: unknown
}

interface PushEventData {
  json(): PushPayload
}

interface NotificationLike {
  close(): void
  data?: { url?: string }
}

interface ClientLike {
  url: string
  focus(): Promise<void>
}

interface ClientsLike {
  matchAll(opts: { type: string }): Promise<ClientLike[]>
  openWindow(url: string): Promise<unknown>
}

// ---------------------------------------------------------------------------
// Default fallback
// ---------------------------------------------------------------------------

const DEFAULT_PAYLOAD: PushPayload = {
  title: 'War Room',
  body: 'New notification',
}

// ---------------------------------------------------------------------------
// parsePushData
// ---------------------------------------------------------------------------

/**
 * Safely parse push event data. Returns a default payload if data is null
 * or JSON parsing fails.
 */
export function parsePushData(data: PushEventData | null): PushPayload {
  if (!data) return { ...DEFAULT_PAYLOAD }

  try {
    return data.json()
  } catch (e) {
    console.error('[SW] Push data parse error:', e)
    return { ...DEFAULT_PAYLOAD }
  }
}

// ---------------------------------------------------------------------------
// buildNotificationOptions
// ---------------------------------------------------------------------------

/**
 * Build the NotificationOptions object from parsed push data.
 */
export function buildNotificationOptions(
  payload: PushPayload,
) {
  return {
    body: payload.body || 'You have a new message',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100] as number[],
    data: { url: payload.url || '/chat' },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }
}

// ---------------------------------------------------------------------------
// handleNotificationClick
// ---------------------------------------------------------------------------

/**
 * Handle notification click: close the notification, then either focus
 * an existing window or open a new one.
 */
export async function handleNotificationClick(
  notification: NotificationLike,
  action: string,
  clients: ClientsLike,
): Promise<void> {
  notification.close()

  if (action === 'dismiss') return

  const url = notification.data?.url || '/chat'

  const clientList = await clients.matchAll({ type: 'window' })
  for (const client of clientList) {
    if (client.url.includes(url) && 'focus' in client) {
      await client.focus()
      return
    }
  }

  await clients.openWindow(url)
}
