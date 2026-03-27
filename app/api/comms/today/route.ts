import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

interface CommsItem {
  source: 'calendar' | 'email' | 'brief' | 'notification'
  title: string
  detail: string | null
  timestamp: string
  unread?: boolean
}

const COMMS_EVENT_TYPES = [
  'brief',
  'notification',
  'message',
  'plan_completed',
  'plan_failed',
  'plan_approved',
  'toji_scan_complete',
  'research_scan_complete',
  'patrol_complete',
]

export async function GET() {
  const items: CommsItem[] = []

  const sb = createServiceClient()
  if (sb) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: events } = await sb
      .from('war_room_events')
      .select('title, event_type, created_at, description')
      .in('event_type', COMMS_EVENT_TYPES)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    for (const e of events || []) {
      items.push({
        source: e.event_type === 'brief' ? 'brief' : 'notification',
        title: e.title,
        detail: e.description,
        timestamp: e.created_at,
      })
    }
  }

  // Placeholder when no events found
  if (items.length === 0) {
    items.push({
      source: 'notification',
      title: 'Messages feed active',
      detail: 'System events, briefs, and notifications will appear here',
      timestamp: new Date().toISOString(),
    })
  }

  const unreadCount = items.filter(i => i.unread).length

  return NextResponse.json({
    items,
    unreadCount,
    totalToday: items.length,
  })
}
