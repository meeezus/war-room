import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { spawnClaude, type ClaudeSession } from '@/lib/claude-cli'
import { saveMessage, getThread, getThreadSessionId, setThreadSessionId } from '@/lib/chat'
import { getAgentSystemPrompt } from '@/lib/agent-identity'
import { createRequestContext } from '@/lib/request-context'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min max for long Claude responses

export async function POST(req: NextRequest) {
  const ctx = createRequestContext()
  const { threadId, content } = await req.json()

  if (!threadId || !content) {
    return Response.json({ error: 'threadId and content are required' }, { status: 400 })
  }

  ctx.log('request_received', { threadId })

  // Save user message
  await saveMessage(threadId, 'user', content)

  // Get or create session ID for this thread
  let sessionId = await getThreadSessionId(threadId)
  const isResume = !!sessionId
  if (!sessionId) {
    sessionId = randomUUID()
    await setThreadSessionId(threadId, sessionId)
  }

  const session: ClaudeSession = { sessionId, threadId }

  // Load agent identity for this thread
  const thread = await getThread(threadId)
  const agentId = thread?.agent_id || 'cc'
  const systemPrompt = agentId !== 'cc' ? getAgentSystemPrompt(agentId) : null

  // Spawn Claude CLI and stream response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = spawnClaude(content, session, { resume: isResume, systemPrompt: systemPrompt || undefined })
        const reader = claudeStream.getReader()
        let fullResponse = ''

        while (true) {
          let readResult
          try {
            readResult = await reader.read()
          } catch (readErr) {
            // Stream errored — if this was a resume attempt, retry with fresh session
            if (isResume && !fullResponse) {
              console.log('[chat/route] Resume stream failed, retrying with new session')
              const newSessionId = randomUUID()
              await setThreadSessionId(threadId, newSessionId)
              const newSession: ClaudeSession = { sessionId: newSessionId, threadId }
              const retryStream = spawnClaude(content, newSession, { resume: false, systemPrompt: systemPrompt || undefined })
              const retryReader = retryStream.getReader()

              while (true) {
                const { done, value } = await retryReader.read()
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

        // Save complete assistant message
        if (fullResponse) {
          const msg = await saveMessage(threadId, 'assistant', fullResponse, agentId)
          const doneData = JSON.stringify({ type: 'done', messageId: msg.id, agentId })
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : typeof err === 'object' ? JSON.stringify(err) : String(err)
        console.error('[chat/route] Error:', errMsg)
        const errorData = JSON.stringify({ type: 'error', message: errMsg })
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  ctx.log('response_sent')
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
