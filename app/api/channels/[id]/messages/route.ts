import { NextResponse } from 'next/server'
import { getChannelMessages, getThreadMessages, saveChannelMessage, forwardMessage } from '@/lib/channels'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const threadId = searchParams.get('threadId')

    if (threadId) {
      const messages = await getThreadMessages(threadId)
      return NextResponse.json(messages)
    }

    const messages = await getChannelMessages(id)
    return NextResponse.json(messages)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    if (body.action === 'forward') {
      const forwarded = await forwardMessage(body.messageId, id)
      return NextResponse.json(forwarded)
    }

    const message = await saveChannelMessage(id, body.role, body.content, {
      agentId: body.agentId,
      replyToId: body.replyToId,
      threadId: body.threadId,
    })
    return NextResponse.json(message)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
