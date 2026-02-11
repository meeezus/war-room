import { NextRequest } from 'next/server'
import { getThreads, createThread } from '@/lib/chat'

export async function GET() {
  try {
    const threads = await getThreads()
    return Response.json({ threads })
  } catch (err) {
    console.error('[threads/route] Error:', err)
    return Response.json({ error: 'Failed to fetch threads' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, agentId } = await req.json()
    const thread = await createThread(title || 'New Thread', agentId)
    return Response.json({ thread })
  } catch (err) {
    console.error('[threads/route] Error:', err)
    return Response.json({ error: 'Failed to create thread' }, { status: 500 })
  }
}
