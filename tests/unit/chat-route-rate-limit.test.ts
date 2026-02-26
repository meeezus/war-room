import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock setup (must happen before import) ----

const mockSaveMessage = vi.fn().mockResolvedValue({ id: 'msg-1' })
const mockGetThread = vi.fn().mockResolvedValue({ agent_id: 'ed', title: 'Test Thread' })
const mockGetThreadSessionId = vi.fn().mockResolvedValue(null)
const mockSetThreadSessionId = vi.fn().mockResolvedValue(undefined)
const mockClearThreadSessionId = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/chat', () => ({
  saveMessage: (...args: unknown[]) => mockSaveMessage(...args),
  getThread: (...args: unknown[]) => mockGetThread(...args),
  getThreadSessionId: (...args: unknown[]) => mockGetThreadSessionId(...args),
  setThreadSessionId: (...args: unknown[]) => mockSetThreadSessionId(...args),
  clearThreadSessionId: (...args: unknown[]) => mockClearThreadSessionId(...args),
}))

vi.mock('@/lib/agent-identity', () => ({
  getAgentSystemPrompt: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/request-context', () => ({
  createRequestContext: vi.fn(() => ({ log: vi.fn() })),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(() => null),
}))

vi.mock('@/lib/openclaw-client', () => ({
  sendToOpenClaw: vi.fn(),
}))

vi.mock('@/lib/claude-cli', () => ({
  spawnClaude: vi.fn().mockImplementation(() =>
    new ReadableStream<string>({
      start(controller) {
        controller.enqueue('Hello from Claude')
        controller.close()
      },
    })
  ),
}))

vi.mock('@/lib/pulse-context', () => ({
  buildPulseContext: vi.fn().mockResolvedValue(''),
}))

vi.mock('@/lib/spark-bridge', () => ({
  emitMessage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/pulse-actions', () => ({
  parseActions: vi.fn().mockReturnValue([]),
  executeActions: vi.fn().mockResolvedValue([]),
  stripActionBlocks: vi.fn((s: string) => s),
}))

vi.mock('@/lib/pulse-alerts', () => ({
  generateAlerts: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn(),
  captureWarning: vi.fn(),
}))

import { POST } from '@/app/api/chat/route'

// ---- Helpers ----

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Drain the SSE stream so the route's finally block runs (inFlightRequests cleanup). */
async function drainStream(response: Response): Promise<void> {
  const reader = response.body!.getReader()
  while (true) {
    const { done } = await reader.read()
    if (done) break
  }
}

// ---- Tests ----

describe('POST /api/chat — rate limiting (max 2 req/sec per thread)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveMessage.mockResolvedValue({ id: 'msg-1' })
    mockGetThread.mockResolvedValue({ agent_id: 'ed', title: 'Test Thread' })
    mockGetThreadSessionId.mockResolvedValue(null)
    mockSetThreadSessionId.mockResolvedValue(undefined)
  })

  it('allows the first request through', async () => {
    const res = await POST(makeRequest({ threadId: 'rl-allow-1', content: 'hello' }) as any)
    expect(res.status).toBe(200)
    await drainStream(res)
  })

  it('allows second request in the same 1s window', async () => {
    const threadId = 'rl-allow-2'
    const res1 = await POST(makeRequest({ threadId, content: 'first' }) as any)
    await drainStream(res1)
    const res2 = await POST(makeRequest({ threadId, content: 'second' }) as any)
    expect(res2.status).toBe(200)
    await drainStream(res2)
  })

  it('blocks the third request in the same 1s window with 429', async () => {
    const threadId = 'rl-block-1'
    const res1 = await POST(makeRequest({ threadId, content: 'first' }) as any)
    await drainStream(res1)
    const res2 = await POST(makeRequest({ threadId, content: 'second' }) as any)
    await drainStream(res2)
    // Third request in the same second — should be rate limited
    const res3 = await POST(makeRequest({ threadId, content: 'third' }) as any)
    expect(res3.status).toBe(429)
    const body = await res3.json()
    expect(body.error).toContain('Rate limit exceeded')
  })

  it('rate limit 429 includes a Retry-After header', async () => {
    const threadId = 'rl-header-1'
    const res1 = await POST(makeRequest({ threadId, content: 'first' }) as any)
    await drainStream(res1)
    const res2 = await POST(makeRequest({ threadId, content: 'second' }) as any)
    await drainStream(res2)
    const res3 = await POST(makeRequest({ threadId, content: 'third' }) as any)

    expect(res3.status).toBe(429)
    const retryAfter = res3.headers.get('Retry-After')
    expect(retryAfter).toBeTruthy()
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(0)
  })

  it('independent thread IDs have separate rate limit buckets', async () => {
    // Saturate thread A
    const a1 = await POST(makeRequest({ threadId: 'rl-iso-A', content: 'first' }) as any)
    await drainStream(a1)
    const a2 = await POST(makeRequest({ threadId: 'rl-iso-A', content: 'second' }) as any)
    await drainStream(a2)
    const a3 = await POST(makeRequest({ threadId: 'rl-iso-A', content: 'third' }) as any)
    expect(a3.status).toBe(429)

    // Thread B should be unaffected
    const b1 = await POST(makeRequest({ threadId: 'rl-iso-B', content: 'first' }) as any)
    expect(b1.status).toBe(200)
    await drainStream(b1)
  })

  it('returns 400 for missing threadId', async () => {
    const res = await POST(makeRequest({ content: 'no thread id here' }) as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('threadId')
  })

  it('returns 400 for missing content', async () => {
    const res = await POST(makeRequest({ threadId: 'rl-400-1' }) as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('content')
  })
})

describe('POST /api/chat — concurrent request protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetThread.mockResolvedValue({ agent_id: 'ed', title: 'Test Thread' })
    mockGetThreadSessionId.mockResolvedValue(null)
    mockSetThreadSessionId.mockResolvedValue(undefined)
  })

  it('blocks a second request to the same thread while the first is in-flight', async () => {
    const threadId = 'concurrent-guard-1'

    // Hang the first saveMessage call so the first request stays in-flight
    let releaseFirst!: (v: { id: string }) => void
    const hangPromise = new Promise<{ id: string }>(resolve => { releaseFirst = resolve })
    mockSaveMessage
      .mockImplementationOnce(() => hangPromise)   // first call: hang
      .mockResolvedValue({ id: 'msg-1' })           // all others: resolve normally

    // Start first request (POST returns before stream finishes, so don't await)
    const firstReqPromise = POST(makeRequest({ threadId, content: 'first' }) as any)

    // Yield control long enough for req.json() to resolve and inFlightRequests.set to run.
    // The route sets inFlightRequests synchronously just before the first saveMessage await.
    await new Promise(resolve => setTimeout(resolve, 10))

    // Second request should be blocked by the concurrent guard
    const res2 = await POST(makeRequest({ threadId, content: 'second' }) as any)
    expect(res2.status).toBe(429)
    const body = await res2.json()
    expect(body.error).toContain('already in progress')

    // Release the first request so the module state gets cleaned up
    releaseFirst({ id: 'msg-1' })
    const res1 = await firstReqPromise
    await drainStream(res1)
  })

  it('concurrent 429 includes Retry-After: 1 header', async () => {
    const threadId = 'concurrent-guard-2'

    let releaseFirst!: (v: { id: string }) => void
    const hangPromise = new Promise<{ id: string }>(resolve => { releaseFirst = resolve })
    mockSaveMessage
      .mockImplementationOnce(() => hangPromise)
      .mockResolvedValue({ id: 'msg-1' })

    const firstReqPromise = POST(makeRequest({ threadId, content: 'first' }) as any)
    await new Promise(resolve => setTimeout(resolve, 10))

    const res2 = await POST(makeRequest({ threadId, content: 'second' }) as any)
    expect(res2.headers.get('Retry-After')).toBe('1')

    releaseFirst({ id: 'msg-1' })
    const res1 = await firstReqPromise
    await drainStream(res1)
  })

  it('allows a second request after the first completes', async () => {
    const threadId = 'concurrent-guard-3'
    mockSaveMessage.mockResolvedValue({ id: 'msg-1' })

    const res1 = await POST(makeRequest({ threadId, content: 'first' }) as any)
    await drainStream(res1) // wait for first to fully complete + cleanup inFlightRequests

    const res2 = await POST(makeRequest({ threadId, content: 'second' }) as any)
    expect(res2.status).toBe(200)
    await drainStream(res2)
  })
})
