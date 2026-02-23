import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { parseStreamLine } from '@/lib/claude-stream-parser'
import { spawn } from 'child_process'

const CLAUDE_PATH = '/opt/homebrew/bin/claude'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  let body: { message?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = body.message?.trim()
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  // Fetch mission to get stored claude_session_id
  const { data: mission, error } = await sb
    .from('missions')
    .select('id, status, result')
    .eq('id', id)
    .single()

  if (error || !mission) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 })
  }

  const result = mission.result as Record<string, unknown> | null
  const claudeSessionId =
    result && typeof result.claude_session_id === 'string'
      ? result.claude_session_id
      : null

  if (!claudeSessionId) {
    return NextResponse.json(
      { error: 'No Claude session available for this mission — mission may still be running or did not capture a session ID' },
      { status: 409 }
    )
  }

  // Spawn Claude with --resume to continue the conversation
  const args = [
    '--print',
    '--output-format', 'stream-json',
    '--resume', claudeSessionId,
    '-p', message,
  ]

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const proc = spawn(CLAUDE_PATH, args, {
        env: { ...process.env, CLAUDECODE: undefined },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let buffer = ''
      let stderrOutput = ''
      let newSessionId: string | null = null

      proc.stdout!.on('data', (data: Buffer) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          // Capture updated session_id from result chunk
          try {
            const raw = JSON.parse(line)
            if (raw.type === 'result' && typeof raw.session_id === 'string') {
              newSessionId = raw.session_id
            }
          } catch {
            // not JSON
          }

          const event = parseStreamLine(line)
          if (event) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            )
          }
        }
      })

      proc.stderr!.on('data', (data: Buffer) => {
        stderrOutput += data.toString()
      })

      proc.on('close', async (code) => {
        if (buffer.trim()) {
          try {
            const raw = JSON.parse(buffer)
            if (raw.type === 'result' && typeof raw.session_id === 'string') {
              newSessionId = raw.session_id
            }
          } catch {
            // ignore
          }
          const event = parseStreamLine(buffer)
          if (event) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }
        }

        // Update session_id if it changed
        if (newSessionId && newSessionId !== claudeSessionId) {
          await sb.from('missions').update({
            result: { ...result, claude_session_id: newSessionId },
          }).eq('id', id)
        }

        if (code !== 0 && code !== null) {
          const errEvent = { type: 'error', message: `Claude exited with code ${code}: ${stderrOutput.slice(0, 300)}` }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`))
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        }

        controller.close()
      })

      proc.on('error', (err) => {
        const errEvent = { type: 'error', message: err.message }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`))
        controller.close()
      })
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
