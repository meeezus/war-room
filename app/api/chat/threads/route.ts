import { NextRequest } from 'next/server'
import { getThreads, createThread, cleanupArchivedThreads } from '@/lib/chat'
import { captureError } from '@/lib/sentry'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = (searchParams.get('status') as 'active' | 'archived') ?? 'active'
    await cleanupArchivedThreads()
    const threads = await getThreads({ status })
    return Response.json({ threads })
  } catch (err) {
    captureError(err, 'threads.GET', { route: '/api/chat/threads' })
    return Response.json({ error: 'Failed to fetch threads' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, agentId } = await req.json()
    const thread = await createThread(title || 'New Thread', agentId)
    return Response.json({ thread })
  } catch (err) {
    captureError(err, 'threads.POST', { route: '/api/chat/threads' })
    return Response.json({ error: 'Failed to create thread' }, { status: 500 })
  }
}
