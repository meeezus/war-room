import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock setup (must happen before import) ----

const mockSaveMessage = vi.fn().mockResolvedValue({ id: 'msg-1' })
const mockGetThread = vi.fn()
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
  getAgentSystemPrompt: vi.fn().mockReturnValue('You are Makima.'),
}))

vi.mock('@/lib/request-context', () => ({
  createRequestContext: vi.fn(() => ({
    log: vi.fn(),
  })),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(() => null),
}))

// Track what sendToOpenClaw receives
let capturedOpenClawMessage = ''
const mockSendToOpenClaw = vi.fn().mockImplementation((msg: string) => {
  capturedOpenClawMessage = msg
  // Return a ReadableStream of strings that completes immediately with a response
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue('Hello from Makima')
      controller.close()
    },
  })
})

vi.mock('@/lib/openclaw-client', () => ({
  sendToOpenClaw: (...args: unknown[]) => mockSendToOpenClaw(...args),
}))

// Track what spawnClaude receives (for fallback scenarios)
let capturedSpawnClaudeMessage = ''
const mockSpawnClaude = vi.fn().mockImplementation((msg: string) => {
  capturedSpawnClaudeMessage = msg
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue('Fallback response')
      controller.close()
    },
  })
})

vi.mock('@/lib/claude-cli', () => ({
  spawnClaude: (...args: unknown[]) => mockSpawnClaude(...args),
}))

// Mock buildPulseContext
const mockBuildPulseContext = vi.fn()

vi.mock('@/lib/pulse-context', () => ({
  buildPulseContext: (...args: unknown[]) => mockBuildPulseContext(...args),
}))

import { POST } from '@/app/api/chat/route'

// Helper: create a NextRequest-like object
function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Helper: read SSE stream and collect chunks
async function readSSEStream(response: Response): Promise<{ chunks: string[]; events: Array<{ type: string; [key: string]: unknown }> }> {
  const chunks: string[] = []
  const events: Array<{ type: string; [key: string]: unknown }> = []
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    // Parse SSE data lines
    const lines = text.split('\n').filter((l) => l.startsWith('data: '))
    for (const line of lines) {
      const jsonStr = line.replace('data: ', '')
      try {
        const parsed = JSON.parse(jsonStr)
        events.push(parsed)
        if (parsed.type === 'chunk') {
          chunks.push(parsed.content)
        }
      } catch {
        // not JSON, skip
      }
    }
  }

  return { chunks, events }
}

describe('POST /api/chat — pulse context injection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOpenClawMessage = ''
    capturedSpawnClaudeMessage = ''
  })

  // ----------------------------------------------------------------
  // Test 1: Makima thread gets pulse context prepended
  // ----------------------------------------------------------------
  it('prepends pulse context to OpenClaw message for Makima threads', async () => {
    mockGetThread.mockResolvedValue({ agent_id: 'makima', title: 'Test Thread' })
    mockBuildPulseContext.mockResolvedValue('Active missions: 3\nPending proposals: 1')

    const res = await POST(makeRequest({
      threadId: 'thread-1',
      content: 'What is the engine doing?',
    }) as any)

    await readSSEStream(res)

    // buildPulseContext should have been called
    expect(mockBuildPulseContext).toHaveBeenCalledTimes(1)

    // sendToOpenClaw should receive message with pulse context wrapper
    expect(mockSendToOpenClaw).toHaveBeenCalledTimes(1)
    const sentMessage = capturedOpenClawMessage
    expect(sentMessage).toContain('[PULSE CONTEXT]')
    expect(sentMessage).toContain('Active missions: 3')
    expect(sentMessage).toContain('Pending proposals: 1')
    expect(sentMessage).toContain('[/PULSE CONTEXT]')
    expect(sentMessage).toContain('User: What is the engine doing?')
  })

  // ----------------------------------------------------------------
  // Test 2: Non-Makima thread does NOT get pulse context
  // ----------------------------------------------------------------
  it('does NOT call buildPulseContext for non-Makima threads', async () => {
    mockGetThread.mockResolvedValue({ agent_id: 'ed', title: 'Ed Thread' })

    const res = await POST(makeRequest({
      threadId: 'thread-2',
      content: 'Build something',
    }) as any)

    await readSSEStream(res)

    expect(mockBuildPulseContext).not.toHaveBeenCalled()
    // spawnClaude should get raw content, no pulse wrapper
    expect(mockSpawnClaude).toHaveBeenCalledTimes(1)
    const sentMessage = capturedSpawnClaudeMessage
    expect(sentMessage).toBe('Build something')
    expect(sentMessage).not.toContain('[PULSE CONTEXT]')
  })

  // ----------------------------------------------------------------
  // Test 3: Empty pulse context sends raw content (no wrapper)
  // ----------------------------------------------------------------
  it('sends raw content when pulse context is empty string', async () => {
    mockGetThread.mockResolvedValue({ agent_id: 'makima', title: 'Makima Thread' })
    mockBuildPulseContext.mockResolvedValue('')

    const res = await POST(makeRequest({
      threadId: 'thread-3',
      content: 'Hello Makima',
    }) as any)

    await readSSEStream(res)

    expect(mockBuildPulseContext).toHaveBeenCalledTimes(1)
    // With empty pulse context, should send raw content
    const sentMessage = capturedOpenClawMessage
    expect(sentMessage).toBe('Hello Makima')
    expect(sentMessage).not.toContain('[PULSE CONTEXT]')
  })

  // ----------------------------------------------------------------
  // Test 4: Pulse context failure is graceful (still sends message)
  // ----------------------------------------------------------------
  it('proceeds without pulse context when buildPulseContext throws', async () => {
    mockGetThread.mockResolvedValue({ agent_id: 'makima', title: 'Makima Thread' })
    mockBuildPulseContext.mockRejectedValue(new Error('Supabase down'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(makeRequest({
      threadId: 'thread-4',
      content: 'Status update?',
    }) as any)

    await readSSEStream(res)

    // Should have logged the error via captureError (format: '[operation]', error, ctx)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[chat/route.pulseContext]',
      expect.any(Error),
      expect.objectContaining({ threadId: 'thread-4' }),
    )

    // Should still send to OpenClaw with raw content (no pulse wrapper)
    expect(mockSendToOpenClaw).toHaveBeenCalledTimes(1)
    const sentMessage = capturedOpenClawMessage
    expect(sentMessage).toBe('Status update?')

    consoleSpy.mockRestore()
  })

  // ----------------------------------------------------------------
  // Test 5: Fallback to spawnClaude also includes pulse context
  // ----------------------------------------------------------------
  it('includes pulse context in fallback spawnClaude message when OpenClaw fails synchronously', async () => {
    mockGetThread.mockResolvedValue({ agent_id: 'makima', title: 'Makima Thread' })
    mockBuildPulseContext.mockResolvedValue('Active missions: 5')

    // Make sendToOpenClaw throw synchronously
    mockSendToOpenClaw.mockImplementationOnce(() => {
      throw new Error('WebSocket not connected')
    })

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const res = await POST(makeRequest({
      threadId: 'thread-5',
      content: 'Fallback test',
    }) as any)

    await readSSEStream(res)

    // Should have fallen back to spawnClaude
    expect(mockSpawnClaude).toHaveBeenCalledTimes(1)
    const sentMessage = capturedSpawnClaudeMessage
    expect(sentMessage).toContain('[PULSE CONTEXT]')
    expect(sentMessage).toContain('Active missions: 5')
    expect(sentMessage).toContain('[/PULSE CONTEXT]')
    expect(sentMessage).toContain('User: Fallback test')

    consoleSpy.mockRestore()
  })

  // ----------------------------------------------------------------
  // Test 6: Fallback on stream read error also includes pulse context
  // ----------------------------------------------------------------
  it('includes pulse context in fallback when OpenClaw stream fails during read', async () => {
    mockGetThread.mockResolvedValue({ agent_id: 'makima', title: 'Makima Thread' })
    mockBuildPulseContext.mockResolvedValue('Pending proposals: 2')

    // Return a stream that errors on read
    mockSendToOpenClaw.mockImplementationOnce(() => {
      return new ReadableStream<string>({
        start(controller) {
          controller.error(new Error('Stream disconnected'))
        },
      })
    })

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const res = await POST(makeRequest({
      threadId: 'thread-6',
      content: 'Stream error test',
    }) as any)

    await readSSEStream(res)

    // Should have fallen back to spawnClaude
    expect(mockSpawnClaude).toHaveBeenCalledTimes(1)
    const sentMessage = capturedSpawnClaudeMessage
    expect(sentMessage).toContain('[PULSE CONTEXT]')
    expect(sentMessage).toContain('Pending proposals: 2')
    expect(sentMessage).toContain('[/PULSE CONTEXT]')
    expect(sentMessage).toContain('User: Stream error test')

    consoleSpy.mockRestore()
  })
})
