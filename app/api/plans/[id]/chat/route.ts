import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { captureError } from '@/lib/sentry'
import { spawn } from 'child_process'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { message } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message required' }, { status: 400 })
    }

    const sb = createServiceClient()
    if (!sb) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
    }

    // Fetch plan
    const { data: plan, error } = await sb.from('plans').select('*').eq('id', id).single()
    if (error || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Append user message to chat history
    const chatHistory: ChatMessage[] = plan.chat_history || []
    chatHistory.push({
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    })

    // Build context for Claude
    const context = buildChatContext(plan, chatHistory)

    // Try streaming via Claude CLI (local only)
    if (!process.env.VERCEL) {
      try {
        const stream = new ReadableStream({
          start(controller) {
            const proc = spawn('claude', [
              '-p',
              '--model', 'claude-sonnet-4-6',
              '--output-format', 'text',
              '--dangerously-skip-permissions',
            ], {
              env: { ...process.env, CLAUDECODE: '' },
              cwd: '/tmp',
            })

            proc.stdin.write(context)
            proc.stdin.end()

            let fullResponse = ''

            proc.stdout.on('data', (chunk: Buffer) => {
              const text = chunk.toString()
              fullResponse += text
              controller.enqueue(new TextEncoder().encode(text))
            })

            proc.on('close', async () => {
              // Save assistant response to chat history
              chatHistory.push({
                role: 'assistant',
                content: fullResponse.trim(),
                timestamp: new Date().toISOString(),
              })

              await sb.from('plans').update({
                chat_history: chatHistory,
                updated_at: new Date().toISOString(),
              }).eq('id', id)

              // Emit event
              await sb.from('war_room_events').insert({
                event_type: 'plan_iterated',
                agent_id: 'system',
                title: `Plan chat: ${plan.title}`,
                metadata: { plan_id: id, message_count: chatHistory.length },
              })

              controller.close()
            })

            proc.on('error', () => {
              controller.enqueue(new TextEncoder().encode('\n[Stream error - try again]'))
              controller.close()
            })
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache',
          },
        })
      } catch {
        // Fall through to fire-and-forget
      }
    }

    // Vercel fallback: save message, set status for poller
    chatHistory.push({
      role: 'assistant',
      content: 'Processing... the agent will respond shortly.',
      timestamp: new Date().toISOString(),
    })

    await sb.from('plans').update({
      chat_history: chatHistory,
      iteration_feedback: message.trim(),
      status: 'brainstorming',
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    // Emit event
    await sb.from('war_room_events').insert({
      event_type: 'plan_iterate_requested',
      agent_id: 'system',
      title: `Plan chat queued: ${plan.title}`,
      metadata: { plan_id: id, message_count: chatHistory.length },
    })

    return NextResponse.json({ status: 'queued', message: 'Processing via poller' })
  } catch (err) {
    captureError(err, 'plans/[id]/chat.POST')
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}

function buildChatContext(plan: Record<string, unknown>, chatHistory: ChatMessage[]): string {
  const beads = (plan.parsed_beads || []) as Array<{ id: string; title: string; size: string; wave_index: number }>
  const beadSummary = beads
    .map((b) => `- ${b.id}: ${b.title} (${b.size}, wave ${b.wave_index})`)
    .join('\n')

  const prevMessages = chatHistory
    .map((m) => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
    .join('\n\n')

  const analysis = plan.analysis as { recommendation?: string } | null

  return `You are helping iterate on a project plan. Be conversational, direct, and specific.
When suggesting changes to the plan, describe them clearly. If the user asks to update beads,
output the updated bead structure in markdown format with ## BEAD-xxx headers.

Current plan: ${plan.title}
Score: ${plan.flywheel_score}/9

Current beads:
${beadSummary || 'No beads yet'}

${analysis?.recommendation ? `Analysis: ${analysis.recommendation}` : ''}

Conversation so far:
${prevMessages}

Respond to the latest message. Keep it concise.`
}
