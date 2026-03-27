import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Plan Iterate API Route Tests
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

const mockBrainstormPlan = vi.fn()
vi.mock('@/lib/plan-brainstorm', () => ({
  brainstormPlan: (...args: unknown[]) => mockBrainstormPlan(...args),
}))

vi.mock('@/lib/plan-parser', () => ({
  parsePlanMarkdown: (md: string) => ({
    title: 'Updated Plan Title',
    beads: [
      { id: 'BEAD-001', title: 'First bead', wave_index: 0 },
      { id: 'BEAD-002', title: 'Second bead', wave_index: 1 },
    ],
    flywheelScore: 4,
    scoreBreakdown: { money: 1, blast_radius: 2, novelty: 1 },
    waveCount: 2,
  }),
}))

vi.mock('@/lib/vault-sync', () => ({
  syncPlanToVault: vi.fn().mockResolvedValue('/path/to/vault/file.md'),
}))

vi.mock('@/lib/plan-analyzer', () => ({
  analyzePlan: vi.fn().mockResolvedValue({
    depth: 'quick',
    pushback: ['Consider edge cases'],
    alternatives: [],
    blind_spots: [],
    recommendation: 'Proceed',
    analyzed_at: new Date().toISOString(),
  }),
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
    mockBrainstormPlan.mockReset()
    mockConfig.selectSingleResult = { data: MOCK_PLAN, error: null }
    mockConfig.updateResult = { data: { ...MOCK_PLAN, status: 'reviewing' }, error: null }
    mockBrainstormPlan.mockResolvedValue({
      markdown: '# Updated Plan\n\n## BEAD-001: First\nDo this\n\n## BEAD-002: Second\nDo that',
      mode: 'builder',
    })
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

  it('calls brainstormPlan with combined context including original + feedback', async () => {
    const req = makeRequest({ feedback: 'Add more tests' })
    await POST(req, { params: mockParams })

    expect(mockBrainstormPlan).toHaveBeenCalledTimes(1)
    const context = mockBrainstormPlan.mock.calls[0][0] as string
    expect(context).toContain('Original idea:')
    expect(context).toContain(MOCK_PLAN.raw_markdown)
    expect(context).toContain('Add more tests')
    expect(context).toContain('feedback')
  })

  it('includes previous bead titles in context', async () => {
    const req = makeRequest({ feedback: 'Refine beads' })
    await POST(req, { params: mockParams })

    const context = mockBrainstormPlan.mock.calls[0][0] as string
    expect(context).toContain('Old bead one')
  })

  it('updates plan status to brainstorming before calling brainstorm', async () => {
    const req = makeRequest({ feedback: 'Improve it' })
    await POST(req, { params: mockParams })

    // First update should set status to brainstorming
    const firstUpdate = mockConfig.updateCalls[0] as Record<string, unknown>
    expect(firstUpdate.status).toBe('brainstorming')
  })

  it('updates plan with brainstormed result on success', async () => {
    const req = makeRequest({ feedback: 'Change things' })
    const res = await POST(req, { params: mockParams })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.beadCount).toBe(2)
    expect(json.waveCount).toBe(2)
  })

  it('emits plan_iterated event', async () => {
    const req = makeRequest({ feedback: 'Make changes' })
    await POST(req, { params: mockParams })

    // Should write to war_room_events
    expect(mockConfig.fromCalls).toContain('war_room_events')
    const eventInsert = mockConfig.insertCalls.find(
      (c: unknown) => (c as Record<string, unknown>).event_type === 'plan_iterated'
    )
    expect(eventInsert).toBeDefined()
  })

  it('returns 500 when brainstorm returns null', async () => {
    mockBrainstormPlan.mockResolvedValue(null)
    const req = makeRequest({ feedback: 'Something broke' })
    const res = await POST(req, { params: mockParams })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/iterate failed/i)
  })

  it('sets status to reviewing for low flywheel scores', async () => {
    const req = makeRequest({ feedback: 'Low stakes change' })
    const res = await POST(req, { params: mockParams })
    const json = await res.json()
    // parsePlanMarkdown mock returns flywheelScore 4 (<=4 -> reviewing)
    expect(json.status).toBe('reviewing')
  })

  it('includes feedback_length in event metadata', async () => {
    const feedback = 'A specific piece of feedback'
    const req = makeRequest({ feedback })
    await POST(req, { params: mockParams })

    const eventInsert = mockConfig.insertCalls.find(
      (c: unknown) => (c as Record<string, unknown>).event_type === 'plan_iterated'
    ) as Record<string, unknown>
    expect((eventInsert.metadata as Record<string, unknown>).feedback_length).toBe(feedback.length)
  })
})
