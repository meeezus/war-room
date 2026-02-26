/**
 * Spark Intelligence Bridge
 * Emits channel messages to sparkd for memory ingestion
 *
 * Format: SparkEventV1
 * Endpoint: localhost:8787/ingest
 */

const SPARKD_URL = process.env.SPARKD_URL || 'http://localhost:8787/ingest'
const SPARKD_TOKEN = process.env.SPARKD_TOKEN || ''

export interface SparkEventV1 {
  v: 1
  source: 'war-room'
  kind: 'message' | 'decision'
  ts: number  // unix seconds
  session_id: string
  payload: Record<string, unknown>
  trace_id?: string
}

/**
 * Emit a message event to Spark
 */
export async function emitMessage(
  channelId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  agentId?: string
): Promise<void> {
  const event: SparkEventV1 = {
    v: 1,
    source: 'war-room',
    kind: 'message',
    ts: Math.floor(Date.now() / 1000),
    session_id: `channel-${channelId}`,
    payload: {
      role,
      content,
      agent_id: agentId ?? null,
    },
  }

  await postToSpark(event)
}

/**
 * Emit a decision event to Spark (from pulse actions)
 */
export async function emitDecision(
  actionType: string,
  result: Record<string, unknown>,
  context?: string
): Promise<void> {
  const event: SparkEventV1 = {
    v: 1,
    source: 'war-room',
    kind: 'decision',
    ts: Math.floor(Date.now() / 1000),
    session_id: `makima-pulse`,
    payload: {
      action_type: actionType,
      result,
      context,
    },
    trace_id: `pulse-${Date.now()}`,
  }

  await postToSpark(event)
}

/**
 * POST event to sparkd
 */
async function postToSpark(event: SparkEventV1): Promise<void> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (SPARKD_TOKEN) {
      headers['Authorization'] = `Bearer ${SPARKD_TOKEN}`
    }

    const res = await fetch(SPARKD_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    })

    if (!res.ok) {
      console.warn('[spark-bridge] POST failed:', res.status, await res.text())
    }
  } catch (err) {
    // Don't throw - spark is optional, shouldn't break the app
    console.warn('[spark-bridge] Connection failed:', err instanceof Error ? err.message : err)
  }
}
