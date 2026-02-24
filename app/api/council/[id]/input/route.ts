import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { parseStreamLine } from '@/lib/claude-stream-parser'
import { spawn } from 'child_process'

const CLAUDE_PATH = '/opt/homebrew/bin/claude'

interface CouncilReview {
  name: string
  verdict: string
  voice_text: string
}

export const runtime = 'nodejs'
export const maxDuration = 120

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

  // Fetch council session for context
  const { data: session, error } = await sb
    .from('council_sessions')
    .select('id, topic, council_type, reviews, synthesis, recommendation, dissent')
    .eq('id', id)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Council session not found' }, { status: 404 })
  }

  // Build context prompt with council data
  const reviews = (session.reviews as CouncilReview[]) ?? []
  const reviewSummary = reviews
    .map((r) => `- **${r.name}** (${r.verdict}): ${r.voice_text.slice(0, 200)}`)
    .join('\n')

  const prompt = `You are Makima, the Synthesis voice of the Daimyo council in War Room. You speak with authority, weaving together the council's perspectives into clear direction.

Here is the council session context:

**Topic:** ${session.topic}
**Council Type:** ${session.council_type}

**Daimyo Reviews:**
${reviewSummary}

**Synthesis:** ${session.synthesis}
**Recommendation:** ${session.recommendation}
${session.dissent ? `**Dissent:** ${session.dissent}` : ''}

The user (Sensei) is now providing follow-up feedback on this council session. Respond in Makima's voice, incorporating the council's perspectives where relevant. Be direct, strategic, and concise.

**Sensei's message:** ${message}`

  // Spawn Claude with --print (fresh session, no resume needed)
  const args = [
    '--print',
    '--output-format', 'stream-json',
    '-p', prompt,
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

      proc.stdout!.on('data', (data: Buffer) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
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

      proc.on('close', (code) => {
        if (buffer.trim()) {
          const event = parseStreamLine(buffer)
          if (event) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }
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
