import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { spawnClaude, type ClaudeSession } from '@/lib/claude-cli'
import { saveMessage, getThreadSessionId, setThreadSessionId } from '@/lib/chat'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min max for long Claude responses

export async function POST(req: NextRequest) {
  const { threadId, content } = await req.json()

  if (!threadId || !content) {
    return Response.json({ error: 'threadId and content are required' }, { status: 400 })
  }

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

  // Spawn Claude CLI and stream response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = spawnClaude(content, session, { resume: isResume })
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
              const retryStream = spawnClaude(content, newSession, { resume: false })
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
          const msg = await saveMessage(threadId, 'assistant', fullResponse, 'cc')
          const doneData = JSON.stringify({ type: 'done', messageId: msg.id })
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error: ' + String(err)
        console.error('[chat/route] Error:', errMsg)
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
