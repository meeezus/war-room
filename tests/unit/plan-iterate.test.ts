import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Plan Iterate API Route Tests (fire-and-forget)
//
// The iterate route saves feedback + sets status='brainstorming', then returns.
// No brainstormPlan/analyzePlan calls. Poller picks up the work.
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
}

const mockConfig: MockConfig = {
  insertResult: { data: null, error: null },
  selectSingleResult: { data: null, error: null },
  updateResult: { data: null, error: null },
  insertCalls: [],
  fromCalls: [],
  updateCalls: [],
}

function resetConfig() {
  mockConfig.insertResult = { data: null, error: null }
  mockConfig.selectSingleResult = { data: null, error: null }
  mockConfig.updateResult = { data: null, error: null }
  mockConfig.insertCalls = []
  mockConfig.fromCalls = []
  mockConfig.updateCalls = []
}

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: () => ({
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
  }),
}))

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn(),
}))

import { POST } from '@/app/api/plans/[id]/iterate/route'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PLAN = {
  id: 'plan-123',
  title: 'Original Plan Title',
  raw_markdown: '# Original Plan\n\nBuild a dashboard',
  parsed_beads: [
    { id: 'BEAD-001', title: 'Old bead one' },
  ],
  status: 'reviewing',
  flywheel_score: 5,
  score_breakdown: { money: 2, blast_radius: 2, novelty: 1 },
  wave_count: 1,
  auto_run: false,
  analysis: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/plans/plan-123/iterate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/plans/[id]/iterate', () => {
  const mockParams = Promise.resolve({ id: 'plan-123' })

  beforeEach(() => {
    resetConfig()
    mockConfig.selectSingleResult = { data: MOCK_PLAN, error: null }
    mockConfig.updateResult = { data: { ...MOCK_PLAN, status: 'brainstorming' }, error: null }
  })

  it('returns 400 when feedback is missing', async () => {
    const req = makeRequest({})
    const res = await POST(req, { params: mockParams })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/feedback/i)
  })

  it('returns 400 when feedback is empty string', async () => {
    const req = makeRequest({ feedback: '   ' })
    const res = await POST(req, { params: mockParams })
    expect(res.status).toBe(400)
  })

  it('returns 404 when plan not found', async () => {
    mockConfig.selectSingleResult = { data: null, error: { message: 'not found' } }
    const req = makeRequest({ feedback: 'Make it better' })
    const res = await POST(req, { params: mockParams })
    expect(res.status).toBe(404)
  })

  it('saves iteration_feedback and sets status to brainstorming', async () => {
    const req = makeRequest({ feedback: 'Add more tests' })
    await POST(req, { params: mockParams })

    const update = mockConfig.updateCalls[0] as Record<string, unknown>
    expect(update.iteration_feedback).toBe('Add more tests')
    expect(update.status).toBe('brainstorming')
  })

  it('returns success with brainstorming status', async () => {
    const req = makeRequest({ feedback: 'Change things' })
    const res = await POST(req, { params: mockParams })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.status).toBe('brainstorming')
    expect(json.message).toBeDefined()
  })

  it('emits plan_iterate_requested event', async () => {
    const req = makeRequest({ feedback: 'Make changes' })
    await POST(req, { params: mockParams })

    expect(mockConfig.fromCalls).toContain('war_room_events')
    const eventInsert = mockConfig.insertCalls.find(
      (c: unknown) => (c as Record<string, unknown>).event_type === 'plan_iterate_requested'
    )
    expect(eventInsert).toBeDefined()
  })

  it('includes feedback_length in event metadata', async () => {
    const feedback = 'A specific piece of feedback'
    const req = makeRequest({ feedback })
    await POST(req, { params: mockParams })

    const eventInsert = mockConfig.insertCalls.find(
      (c: unknown) => (c as Record<string, unknown>).event_type === 'plan_iterate_requested'
    ) as Record<string, unknown>
    expect((eventInsert.metadata as Record<string, unknown>).feedback_length).toBe(feedback.length)
  })
})
