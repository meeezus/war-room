import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { spawnClaude, type ClaudeSession } from '@/lib/claude-cli'
import { getAgentSystemPrompt } from '@/lib/agent-identity'
import { sendToOpenClaw } from '@/lib/openclaw-client'
import { streamAnthropicChat, isAnthropicAvailable } from '@/lib/anthropic-chat'
import { buildPulseContext } from '@/lib/pulse-context'
import { saveChannelMessage } from '@/lib/channels'
import { parseActions, executeActions, stripActionBlocks, type PulseAction } from '@/lib/pulse-actions'
import { emitMessage } from '@/lib/spark-bridge'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * POST /api/chat/channel-reply
 *
 * Streams a Makima response for a channel message. Works the same as the
 * DM chat route but saves the assistant response as a channel message
 * instead of a chat_messages row.
 *
 * Body: { channelId: string, content: string }
 * Response: SSE stream (typing / chunk / done / error events)
 */
export async function POST(req: NextRequest) {
  const { channelId, content } = await req.json()

  if (!channelId || !content) {
    return Response.json(
      { error: 'channelId and content are required' },
      { status: 400 }
    )
  }

  const agentId = 'makima'
  const systemPrompt = getAgentSystemPrompt(agentId)

  // Emit user message to Spark
  emitMessage(channelId, 'user', content).catch(() => {})

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Typing indicator
        const typingData = JSON.stringify({ type: 'typing' })
        controller.enqueue(encoder.encode(`data: ${typingData}\n\n`))

        // Build Pulse context for Makima
        let pulseContext = ''
        try {
          pulseContext = await buildPulseContext()
        } catch (err) {
          console.error('[channel-reply] Pulse context failed:', err)
        }

        const messageWithPulse = pulseContext
          ? `[PULSE CONTEXT]\n${pulseContext}\n[/PULSE CONTEXT]\n\nUser (in channel): ${content}`
          : `User (in channel): ${content}`

        // Priority: Anthropic API (production) > OpenClaw (local) > Claude CLI (local fallback)
        let sourceStream: ReadableStream<string>

        if (isAnthropicAvailable()) {
          console.log('[channel-reply] Using Anthropic API')
          sourceStream = streamAnthropicChat(messageWithPulse, {
            systemPrompt: systemPrompt || undefined,
          })
        } else {
          try {
            console.log('[channel-reply] Trying OpenClaw')
            sourceStream = sendToOpenClaw(messageWithPulse)
          } catch {
            console.log('[channel-reply] OpenClaw unavailable, falling back to claude --print')
            const session: ClaudeSession = { sessionId: randomUUID(), threadId: `channel-${channelId}` }
            sourceStream = spawnClaude(messageWithPulse, session, {
              resume: false,
              systemPrompt: systemPrompt || undefined,
            })
          }
        }

        const reader = sourceStream.getReader()
        let fullResponse = ''
        const STREAM_READ_TIMEOUT = 30_000
        const readWithTimeout = () =>
          Promise.race([
            reader.read(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error('Stream read timed out after 30s')),
                STREAM_READ_TIMEOUT
              )
            ),
          ])

        while (true) {
          let readResult
          try {
            readResult = await readWithTimeout()
          } catch (readErr) {
            // Fall back to claude --print only if not in production and no content yet
            if (!fullResponse && !isAnthropicAvailable()) {
              console.log('[channel-reply] Stream failed, falling back to claude --print')
              const fallbackSession: ClaudeSession = {
                sessionId: randomUUID(),
                threadId: `channel-${channelId}`,
              }
              const fallbackStream = spawnClaude(messageWithPulse, fallbackSession, {
                resume: false,
                systemPrompt: systemPrompt || undefined,
              })
              const fallbackReader = fallbackStream.getReader()

              while (true) {
                const { done, value } = await fallbackReader.read()
                if (done) break
                fullResponse += value
                const sseData = JSON.stringify({ type: 'chunk', content: value })
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
              }
              break
            }
            throw readErr
          }

          const { done, value } = readResult
          if (done) break

          fullResponse += value
          const sseData = JSON.stringify({ type: 'chunk', content: value })
          controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
        }

        // Parse and strip action blocks
        let displayResponse = fullResponse
        let pendingActions: PulseAction[] = []

        if (fullResponse) {
          pendingActions = parseActions(fullResponse)
          if (pendingActions.length > 0) {
            displayResponse = stripActionBlocks(fullResponse)
          }
        }

        // Save assistant message to channel
        if (fullResponse) {
          const msg = await saveChannelMessage(channelId, 'assistant', displayResponse, {
            agentId,
          })
          const doneData = JSON.stringify({ type: 'done', messageId: msg.id, agentId })
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))

          // Emit assistant message to Spark
          emitMessage(channelId, 'assistant', displayResponse, 'makima').catch(() => {})
        }

        // Execute actions fire-and-forget
        if (pendingActions.length > 0) {
          executeActions(pendingActions)
            .then((results) => {
              console.log(
                `[channel-reply] Executed ${pendingActions.length} action(s):`,
                results.map((r) => `${r.action.type}: ${r.success ? 'ok' : r.message}`)
              )
            })
            .catch((err) => console.error('[channel-reply] Action execution failed:', err))
        }
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : typeof err === 'object'
              ? JSON.stringify(err)
              : String(err)
        console.error('[channel-reply] Error:', errMsg)
        const errorData = JSON.stringify({ type: 'error', message: errMsg })
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
      } finally {
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
