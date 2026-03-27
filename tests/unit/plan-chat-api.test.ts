import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Plan Chat API Route Tests
//
// The chat route:
// 1. Validates message input
// 2. Fetches the plan
// 3. Appends user message to chat_history
// 4. On Vercel: saves + sets status brainstorming, returns JSON
// 5. Locally: streams via Claude CLI, saves full response after
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mock config -- configurable per test
// ---------------------------------------------------------------------------

interface MockConfig {
  insertResult: { data: unknown; error: unknown }
  selectSingleResult: { data: unknown; error: unknown }
  updateResult: { data: unknown; error: unknown }
  insertCalls: unknown[]
  fromCalls: string[]
  updateCalls: unknown[]
  serviceClientNull: boolean
}

const mockConfig: MockConfig = {
  insertResult: { data: null, error: null },
  selectSingleResult: { data: null, error: null },
  updateResult: { data: null, error: null },
  insertCalls: [],
  fromCalls: [],
  updateCalls: [],
  serviceClientNull: false,
}

function resetConfig() {
  mockConfig.insertResult = { data: null, error: null }
  mockConfig.selectSingleResult = { data: null, error: null }
  mockConfig.updateResult = { data: null, error: null }
  mockConfig.insertCalls = []
  mockConfig.fromCalls = []
  mockConfig.updateCalls = []
  mockConfig.serviceClientNull = false
}

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: () => {
    if (mockConfig.serviceClientNull) return null
    return {
      from: (table: string) => {
        mockConfig.fromCalls.push(table)
        const chain: Record<string, unknown> = {}

        chain.insert = (data: unknown) => {
          mockConfig.insertCalls.push(data)
          return {
            select: () => ({
              single: () => Promise.resolve(mockConfig.insertResult),
            }),
            then: (fn: (v: unknown) => unknown) => fn(mockConfig.insertResult),
          }
        }

        chain.select = () => {
          const selectChain: Record<string, unknown> = {}
          selectChain.eq = () => ({
            single: () => Promise.resolve(mockConfig.selectSingleResult),
          })
          return selectChain
        }

        chain.update = (data: unknown) => {
          mockConfig.updateCalls.push(data)
          return {
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve(mockConfig.updateResult),
              }),
              then: (fn: (v: unknown) => unknown) => fn(mockConfig.updateResult),
            }),
          }
        }

        return chain
      },
    }
  },
}))

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn(),
}))

import { POST } from '@/app/api/plans/[id]/chat/route'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PLAN = {
  id: 'plan-123',
  title: 'Test Plan',
  raw_markdown: '# Test Plan\n\nBuild something cool',
  parsed_beads: [
    { id: 'BEAD-001', title: 'First bead', wave_index: 0 },
  ],
  analysis: { recommendation: 'Ship it' },
  chat_history: [],
  status: 'reviewing',
  flywheel_score: 5,
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/plans/plan-123/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id = 'plan-123') {
  return { params: Promise.resolve({ id }) }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/plans/[id]/chat', () => {
  beforeEach(() => {
    resetConfig()
    // Set VERCEL to simulate Vercel deployment (non-streaming fallback)
    process.env.VERCEL = '1'
  })

  it('returns 400 when message is empty', async () => {
    const res = await POST(makeRequest({ message: '' }), makeParams())
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('message required')
  })

  it('returns 400 when message is missing', async () => {
    const res = await POST(makeRequest({}), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 400 when message is whitespace only', async () => {
    const res = await POST(makeRequest({ message: '   ' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 500 when service client is null', async () => {
    mockConfig.serviceClientNull = true
    const res = await POST(makeRequest({ message: 'hello' }), makeParams())
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Service unavailable')
  })

  it('returns 404 when plan not found', async () => {
    mockConfig.selectSingleResult = { data: null, error: { message: 'not found' } }
    const res = await POST(makeRequest({ message: 'hello' }), makeParams())
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Plan not found')
  })

  it('on Vercel: saves message to chat_history and sets status brainstorming', async () => {
    mockConfig.selectSingleResult = { data: { ...MOCK_PLAN }, error: null }
    const res = await POST(makeRequest({ message: 'Make it better' }), makeParams())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('queued')

    // Should have called update on plans table
    expect(mockConfig.updateCalls.length).toBeGreaterThan(0)
    const updatePayload = mockConfig.updateCalls[0] as Record<string, unknown>
    expect(updatePayload.status).toBe('brainstorming')
    expect(updatePayload.iteration_feedback).toBe('Make it better')

    // chat_history should contain user message + placeholder assistant message
    const history = updatePayload.chat_history as Array<{ role: string; content: string }>
    expect(history.length).toBe(2)
    expect(history[0].role).toBe('user')
    expect(history[0].content).toBe('Make it better')
    expect(history[1].role).toBe('assistant')
  })

  it('preserves existing chat history when appending new messages', async () => {
    const existingHistory = [
      { role: 'user', content: 'First message', timestamp: '2026-03-27T01:00:00Z' },
      { role: 'assistant', content: 'First reply', timestamp: '2026-03-27T01:01:00Z' },
    ]
    mockConfig.selectSingleResult = {
      data: { ...MOCK_PLAN, chat_history: existingHistory },
      error: null,
    }

    const res = await POST(makeRequest({ message: 'Follow up' }), makeParams())
    expect(res.status).toBe(200)

    const updatePayload = mockConfig.updateCalls[0] as Record<string, unknown>
    const history = updatePayload.chat_history as Array<{ role: string; content: string }>
    // 2 existing + 1 new user + 1 placeholder assistant = 4
    expect(history.length).toBe(4)
    expect(history[0].content).toBe('First message')
    expect(history[1].content).toBe('First reply')
    expect(history[2].content).toBe('Follow up')
    expect(history[2].role).toBe('user')
    expect(history[3].role).toBe('assistant')
  })

  it('handles null chat_history on plan gracefully', async () => {
    mockConfig.selectSingleResult = {
      data: { ...MOCK_PLAN, chat_history: null },
      error: null,
    }

    const res = await POST(makeRequest({ message: 'hello' }), makeParams())
    expect(res.status).toBe(200)

    const updatePayload = mockConfig.updateCalls[0] as Record<string, unknown>
    const history = updatePayload.chat_history as Array<{ role: string }>
    expect(history.length).toBe(2)
    expect(history[0].role).toBe('user')
  })

  it('emits a war_room_events entry for the chat message', async () => {
    mockConfig.selectSingleResult = { data: { ...MOCK_PLAN }, error: null }
    await POST(makeRequest({ message: 'test' }), makeParams())

    // Should have inserted into war_room_events
    const eventsInserted = mockConfig.fromCalls.includes('war_room_events')
    expect(eventsInserted).toBe(true)
  })

  it('includes timestamp on each chat message', async () => {
    mockConfig.selectSingleResult = { data: { ...MOCK_PLAN }, error: null }
    await POST(makeRequest({ message: 'timestamped' }), makeParams())

    const updatePayload = mockConfig.updateCalls[0] as Record<string, unknown>
    const history = updatePayload.chat_history as Array<{ timestamp: string }>
    expect(history[0].timestamp).toBeDefined()
    expect(history[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
