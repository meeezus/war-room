import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { spawnClaude, type ClaudeSession } from '@/lib/claude-cli'
import { saveMessage, getThread, getThreadSessionId, setThreadSessionId, clearThreadSessionId } from '@/lib/chat'
import { getAgentSystemPrompt } from '@/lib/agent-identity'
import { createRequestContext } from '@/lib/request-context'
import { sendToOpenClaw } from '@/lib/openclaw-client'
import { createServiceClient } from '@/lib/supabase-server'
import { buildPulseContext } from '@/lib/pulse-context'
import { parseActions, executeActions, stripActionBlocks, type PulseAction } from '@/lib/pulse-actions'
import { generateAlerts } from '@/lib/pulse-alerts'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min max for long Claude responses

// --- In-process rate limiting and concurrent request protection ---
// Note: in-memory, per-process. Adequate for single-instance deployment.
// For multi-instance (Vercel scale-out), promote to Redis-backed middleware.
const inFlightRequests = new Map<string, boolean>()
const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_WINDOW_MS = 1000 // 1-second sliding window
const RATE_LIMIT_MAX_REQUESTS = 2 // max 2 requests per second per thread

function checkRateLimit(threadId: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const bucket = rateLimitBuckets.get(threadId)
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(threadId, { count: 1, windowStart: now })
    return { allowed: true, retryAfterMs: 0 }
  }
  if (bucket.count < RATE_LIMIT_MAX_REQUESTS) {
    bucket.count++
    return { allowed: true, retryAfterMs: 0 }
  }
  return { allowed: false, retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart) }
}

export async function POST(req: NextRequest) {
  const ctx = createRequestContext()
  const { threadId, content } = await req.json()

  if (!threadId || !content) {
    return Response.json({ error: 'threadId and content are required' }, { status: 400 })
  }

  ctx.log('request_received', { threadId })

  // --- Concurrent request guard ---
  if (inFlightRequests.get(threadId)) {
    return Response.json(
      { error: 'A request is already in progress for this thread.' },
      { status: 429, headers: { 'Retry-After': '1' } }
    )
  }

  // --- Rate limiting: max 2 requests per second per thread ---
  const { allowed, retryAfterMs } = checkRateLimit(threadId)
  if (!allowed) {
    return Response.json(
      { error: 'Rate limit exceeded. Max 2 requests per second per thread.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  // Mark in-flight synchronously — no yields between check and set
  inFlightRequests.set(threadId, true)

  // Save user message
  await saveMessage(threadId, 'user', content)

  // Load agent identity for this thread
  const thread = await getThread(threadId)
  const agentId = thread?.agent_id || 'cc'
  const systemPrompt = agentId !== 'cc' ? getAgentSystemPrompt(agentId) : null
  const isMakima = agentId === 'makima'

  // Session management — only for non-Makima (claude --print) threads.
  // Makima threads use OpenClaw which manages its own sessions.
  let session: ClaudeSession | null = null
  let isResume = false
  if (isMakima) {
    // Clean up any stale session ID left by old code
    const staleId = await getThreadSessionId(threadId)
    if (staleId) {
      console.log(`[chat/route] Clearing stale session ID from Makima thread ${threadId}`)
      await clearThreadSessionId(threadId)
    }
  } else {
    let sessionId = await getThreadSessionId(threadId)
    isResume = !!sessionId
    if (!sessionId) {
      sessionId = randomUUID()
      await setThreadSessionId(threadId, sessionId)
    }
    session = { sessionId, threadId }
  }

  // Spawn Claude CLI and stream response
  // NOTE: Pulse context for Makima is built INSIDE the stream to avoid blocking
  // the HTTP response. A typing indicator is sent first for instant feedback.
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send typing indicator immediately — client sees feedback within milliseconds
        const typingData = JSON.stringify({ type: 'typing' })
        controller.enqueue(encoder.encode(`data: ${typingData}\n\n`))

        // Choose stream source: Makima goes through OpenClaw, others through claude --print
        let sourceStream: ReadableStream<string>
        // Hoisted so fallback error handler can also access it
        let pulseContext = ''

        if (isMakima) {
          // Build pulse context here (inside stream) so the typing indicator
          // is already visible to the user while we query Supabase
          const pulseStart = Date.now()
          try {
            pulseContext = await buildPulseContext()

            // Auto-inject alerts on first message or after 4h+ gap
            const sb = createServiceClient()
            let shouldInjectAlerts = false
            if (sb) {
              const { data: lastMsg } = await sb
                .from('chat_messages')
                .select('created_at')
                .eq('thread_id', threadId)
                .eq('role', 'assistant')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

              if (!lastMsg) {
                shouldInjectAlerts = true // First message in thread
              } else {
                const hoursSinceLast = (Date.now() - new Date(lastMsg.created_at).getTime()) / (1000 * 60 * 60)
                shouldInjectAlerts = hoursSinceLast >= 4
              }
            }

            if (shouldInjectAlerts) {
              const alerts = await generateAlerts()
              if (alerts.length > 0) {
                const alertLines = alerts.map(a => `- **[${a.severity.toUpperCase()}]** ${a.message}`)
                pulseContext = pulseContext.replace(
                  '### Active Projects',
                  `### Alerts\n${alertLines.join('\n')}\n\n### Active Projects`
                )
                console.log(`[chat/route] Injected ${alerts.length} pulse alert(s)`)
              }
            }

            console.log(`[chat/route] Pulse context built in ${Date.now() - pulseStart}ms`)
          } catch (err) {
            console.error('[chat/route] Pulse context failed, proceeding without:', err)
          }

          const messageWithPulse = pulseContext
            ? `[PULSE CONTEXT]\n${pulseContext}\n[/PULSE CONTEXT]\n\nUser: ${content}`
            : content
          try {
            sourceStream = sendToOpenClaw(messageWithPulse)
          } catch {
            // sendToOpenClaw is synchronous, but catch just in case
            console.log('[chat/route] OpenClaw unavailable, falling back to claude --print')
            const fallbackSession: ClaudeSession = { sessionId: randomUUID(), threadId }
            sourceStream = spawnClaude(messageWithPulse, fallbackSession, { resume: false, systemPrompt: systemPrompt || undefined })
          }
        } else {
          sourceStream = spawnClaude(content, session!, { resume: isResume, systemPrompt: systemPrompt || undefined })
        }

        const reader = sourceStream.getReader()
        let fullResponse = ''
        const STREAM_READ_TIMEOUT = 30_000
        const readWithTimeout = () => Promise.race([
          reader.read(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Stream read timed out after 30s')), STREAM_READ_TIMEOUT)
          )
        ])

        while (true) {
          let readResult
          try {
            readResult = await readWithTimeout()
          } catch (readErr) {
            // For Makima/OpenClaw: if stream errors before any content, fall back to spawnClaude
            if (isMakima && !fullResponse) {
              console.log('[chat/route] OpenClaw stream failed, falling back to claude --print')
              const fallbackMessage = pulseContext
                ? `[PULSE CONTEXT]\n${pulseContext}\n[/PULSE CONTEXT]\n\nUser: ${content}`
                : content
              const fallbackSession: ClaudeSession = { sessionId: randomUUID(), threadId }
              const fallbackStream = spawnClaude(fallbackMessage, fallbackSession, { resume: false, systemPrompt: systemPrompt || undefined })
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

            // For spawnClaude: if resume failed before any content, retry with fresh session
            if (!isMakima && isResume && !fullResponse) {
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

        // Parse actions but don't execute yet — done event must go first
        let displayResponse = fullResponse
        let pendingActions: PulseAction[] = []

        if (isMakima && fullResponse) {
          pendingActions = parseActions(fullResponse)
          if (pendingActions.length > 0) {
            displayResponse = stripActionBlocks(fullResponse)
          }
        }

        // Save message and send done event FIRST (before any action side effects)
        if (fullResponse) {
          const msg = await saveMessage(threadId, 'assistant', displayResponse, agentId)
          const doneData = JSON.stringify({ type: 'done', messageId: msg.id, agentId })
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))

          // Auto-title: if thread still has default title, generate one from user's first message
          if (thread?.title === 'New Thread' || !thread?.title) {
            autoTitleThread(threadId, content).catch((err) =>
              console.error('[chat/route] Auto-title failed:', err)
            )
          }
        }

        // Execute actions AFTER done event — fire-and-forget, don't block response
        if (pendingActions.length > 0) {
          executeActions(pendingActions)
            .then((actionResults) => {
              console.log(`[chat/route] Executed ${pendingActions.length} pulse action(s):`,
                actionResults.map(r => `${r.action.type}: ${r.success ? 'ok' : r.message}`))
            })
            .catch((err) => console.error('[chat/route] Action execution failed:', err))
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : typeof err === 'object' ? JSON.stringify(err) : String(err)
        console.error('[chat/route] Error:', errMsg)
        const errorData = JSON.stringify({ type: 'error', message: errMsg })
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
      } finally {
        inFlightRequests.delete(threadId)
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

/** Generate a short title from the user's first message and update the thread. */
async function autoTitleThread(threadId: string, userMessage: string): Promise<void> {
  const fillerPrefixes = /^(let'?s|i want to|can you|help me|please|hey|hi|hello)\s+/i
  let title = userMessage.split('\n')[0].trim() // first line only
  title = title.replace(fillerPrefixes, '')
  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1)
  // Trim to ~60 chars at word boundary
  if (title.length > 60) {
    title = title.slice(0, 60).replace(/\s+\S*$/, '...')
  }
  if (!title) return

  const sb = createServiceClient()
  if (!sb) return
  await sb
    .from('chat_threads')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', threadId)
}
