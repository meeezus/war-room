import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { spawnClaudeRaw } from '@/lib/claude-cli'
import { parseStreamLine } from '@/lib/claude-stream-parser'

/**
 * GET /api/council/[id]/stream
 *
 * Server-sent events stream for live council execution output.
 * Spawns Claude with the council session topic as the prompt and
 * streams parse events back to the InlineTerminal component.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  const { data: session, error } = await sb
    .from('council_sessions')
    .select('id, topic, council_type')
    .eq('id', id)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const prompt = `You are reviewing a council session. Topic: "${session.topic}" (type: ${session.council_type}). Provide a brief execution summary.`
  const rawStream = spawnClaudeRaw(prompt)

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = rawStream.getReader()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const event = parseStreamLine(value)
          if (event) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            )
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
        )
      } finally {
        reader.releaseLock()
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
