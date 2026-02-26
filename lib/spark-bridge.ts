import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface SparkEventV1 {
  v: 1
  source: 'war-room'
  kind: 'decision' | 'action' | 'insight'
  ts: number
  session_id: string
  payload: {
    action_type: string
    result: unknown
    context?: string
  }
  trace_id: string
}

function getSparkInbox(): string {
  return join(process.env.HOME || '', '.spark', 'inbox')
}

export function isSparkAvailable(): boolean {
  try {
    return existsSync(join(process.env.HOME || '', '.spark'))
  } catch {
    return false
  }
}

export async function emitToSpark(
  kind: SparkEventV1['kind'],
  actionType: string,
  result: unknown,
  options?: { sessionId?: string; context?: string }
): Promise<boolean> {
  if (typeof window !== 'undefined') {
    console.warn('emitToSpark called from client')
    return false
  }

  if (!isSparkAvailable()) return false

  const traceId = randomUUID()
  const event: SparkEventV1 = {
    v: 1,
    source: 'war-room',
    kind,
    ts: Math.floor(Date.now() / 1000),
    session_id: options?.sessionId || 'war-room-default',
    payload: {
      action_type: actionType,
      result,
      context: options?.context,
    },
    trace_id: traceId,
  }

  try {
    const inbox = getSparkInbox()
    await mkdir(inbox, { recursive: true })
    const filename = `war-room-${Date.now()}-${traceId.slice(0, 8)}.json`
    await writeFile(join(inbox, filename), JSON.stringify(event, null, 2))
    console.log(`[Spark] Emitted ${kind}:${actionType} -> ${filename}`)
    return true
  } catch (error) {
    console.error('[Spark] Failed:', error)
    return false
  }
}

export async function emitDecision(actionType: string, result: unknown, context?: string): Promise<boolean> {
  return emitToSpark('decision', actionType, result, { context })
}

export async function emitAction(actionType: string, result: unknown, context?: string): Promise<boolean> {
  return emitToSpark('action', actionType, result, { context })
}

export async function emitInsight(insight: string, metadata?: Record<string, unknown>): Promise<boolean> {
  return emitToSpark('insight', 'insight', { insight, ...metadata })
}
