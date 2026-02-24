import { NextRequest } from 'next/server'
import { sendToOpenClaw } from '@/lib/openclaw-client'
import { spawnClaude } from '@/lib/claude-cli'
import { getAgentSystemPrompt } from '@/lib/agent-identity'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const { message, context } = await req.json()

  if (!message) {
    return Response.json({ error: 'message is required' }, { status: 400 })
  }

  const systemPrompt = getAgentSystemPrompt('makima')
  const fullMessage = context
    ? `[CONTEXT]\n${context}\n[/CONTEXT]\n\nUser: ${message}`
    : message

  const encoder = new TextEncoder()
  const sessionId = randomUUID()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let sourceStream: ReadableStream<string>

        try {
          sourceStream = sendToOpenClaw(fullMessage)
        } catch {
          sourceStream = spawnClaude(fullMessage, { sessionId, threadId: sessionId }, {
            resume: false,
            systemPrompt: systemPrompt || undefined,
          })
        }

        const reader = sourceStream.getReader()

        while (true) {
          let readResult
          try {
            readResult = await reader.read()
          } catch {
            // OpenClaw failed mid-stream, fall back to spawnClaude
            const fallback = spawnClaude(fullMessage, { sessionId: randomUUID(), threadId: sessionId }, {
              resume: false,
              systemPrompt: systemPrompt || undefined,
            })
            const fbReader = fallback.getReader()
            while (true) {
              const { done, value } = await fbReader.read()
              if (done) break
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: value })}\n\n`))
            }
            break
          }

          const { done, value } = readResult
          if (done) break
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: value })}\n\n`))
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        controller.close()
      } catch (err) {
        console.error('[makima-popup] stream error:', err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream failed' })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
