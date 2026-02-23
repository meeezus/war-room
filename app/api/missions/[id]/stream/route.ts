import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { spawnClaudeRaw } from '@/lib/claude-cli'
import { parseStreamLine } from '@/lib/claude-stream-parser'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  // Verify mission exists and is queued
  const { data: mission, error } = await sb
    .from('missions')
    .select('id, status, description')
    .eq('id', id)
    .single()

  if (error || !mission) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 })
  }

  if (mission.status !== 'queued') {
    return NextResponse.json(
      { error: `Mission not in queued state (current: ${mission.status})` },
      { status: 400 }
    )
  }

  // Update status to running
  await sb.from('missions').update({
    status: 'running',
    started_at: new Date().toISOString(),
  }).eq('id', id)

  const brief = mission.description ?? `Execute mission ${id}`
  const rawStream = spawnClaudeRaw(brief)

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = rawStream.getReader()
      let failed = false
      let claudeSessionId: string | null = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Extract session_id from result chunks before parsing into events
          try {
            const raw = JSON.parse(value)
            if (raw.type === 'result' && typeof raw.session_id === 'string') {
              claudeSessionId = raw.session_id
            }
          } catch {
            // not JSON, ignore
          }

          const event = parseStreamLine(value)
          if (event) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            )
          }
        }

        await sb.from('missions').update({
          status: 'done',
          completed_at: new Date().toISOString(),
          result: claudeSessionId ? { claude_session_id: claudeSessionId } : null,
        }).eq('id', id)

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        )
      } catch (err) {
        failed = true
        const message = err instanceof Error ? err.message : 'Unknown error'

        await sb.from('missions').update({ status: 'failed' }).eq('id', id)

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
        )
      } finally {
        reader.releaseLock()
        controller.close()
      }

      void failed // suppress unused warning
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
