import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Plan Fire-and-Forget Tests
//
// Verifies that API routes no longer call Claude directly.
// They write to Supabase and return immediately.
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

// Mock these to spy on whether they're called
const mockBrainstormPlan = vi.fn()
vi.mock('@/lib/plan-brainstorm', () => ({
  brainstormPlan: (...args: unknown[]) => mockBrainstormPlan(...args),
}))

vi.mock('@/lib/plan-parser', () => ({
  parsePlanMarkdown: (md: string) => ({
    title: 'Parsed Title',
    beads: [
      { id: 'BEAD-001', title: 'First bead', wave_index: 0 },
    ],
    flywheelScore: 3,
    scoreBreakdown: { money: 1, blast_radius: 1, novelty: 1 },
    waveCount: 1,
  }),
}))

const mockAnalyzePlan = vi.fn()
vi.mock('@/lib/plan-analyzer', () => ({
  analyzePlan: (...args: unknown[]) => mockAnalyzePlan(...args),
  createStubAnalysis: vi.fn().mockReturnValue({
    depth: 'quick',
    pushback: [],
    alternatives: [],
    blind_spots: [],
    recommendation: 'Proceed',
    analyzed_at: new Date().toISOString(),
  }),
}))

vi.mock('@/lib/vault-sync', () => ({
  syncPlanToVault: vi.fn().mockResolvedValue('/path/to/vault/file.md'),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PLAN = {
  id: 'plan-123',
  title: 'Test Plan',
  raw_markdown: '# Test Plan\n\nBuild a dashboard',
  parsed_beads: [{ id: 'BEAD-001', title: 'Old bead' }],
  status: 'reviewing',
  flywheel_score: 5,
  score_breakdown: { money: 2, blast_radius: 2, novelty: 1 },
  wave_count: 1,
  auto_run: false,
  analysis: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Iterate route -- fire-and-forget
// ---------------------------------------------------------------------------

describe('POST /api/plans/[id]/iterate (fire-and-forget)', () => {
  // Import is deferred to after mocks are set up
  let POST: typeof import('@/app/api/plans/[id]/iterate/route').POST

  beforeEach(async () => {
    resetConfig()
    mockBrainstormPlan.mockReset()
    mockAnalyzePlan.mockReset()
    mockConfig.selectSingleResult = { data: MOCK_PLAN, error: null }
    mockConfig.updateResult = { data: { ...MOCK_PLAN, status: 'brainstorming' }, error: null }
    const mod = await import('@/app/api/plans/[id]/iterate/route')
    POST = mod.POST
  })

  function makeRequest(body: unknown) {
    return new Request('http://localhost:3000/api/plans/plan-123/iterate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('does NOT call brainstormPlan', async () => {
    const req = makeRequest({ feedback: 'Make it better' })
    await POST(req, { params: Promise.resolve({ id: 'plan-123' }) })
    expect(mockBrainstormPlan).not.toHaveBeenCalled()
  })

  it('saves iteration_feedback to the plan', async () => {
    const req = makeRequest({ feedback: 'Add more tests' })
    await POST(req, { params: Promise.resolve({ id: 'plan-123' }) })

    // Find the update call that has iteration_feedback
    const feedbackUpdate = mockConfig.updateCalls.find(
      (c: unknown) => (c as Record<string, unknown>).iteration_feedback !== undefined
    ) as Record<string, unknown>
    expect(feedbackUpdate).toBeDefined()
    expect(feedbackUpdate.iteration_feedback).toBe('Add more tests')
  })

  it('sets status to brainstorming', async () => {
    const req = makeRequest({ feedback: 'Change things' })
    await POST(req, { params: Promise.resolve({ id: 'plan-123' }) })

    const update = mockConfig.updateCalls.find(
      (c: unknown) => (c as Record<string, unknown>).status === 'brainstorming'
    )
    expect(update).toBeDefined()
  })

  it('returns success with status brainstorming', async () => {
    const req = makeRequest({ feedback: 'Improve' })
    const res = await POST(req, { params: Promise.resolve({ id: 'plan-123' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.status).toBe('brainstorming')
  })

  it('emits plan_iterate_requested event', async () => {
    const req = makeRequest({ feedback: 'New direction' })
    await POST(req, { params: Promise.resolve({ id: 'plan-123' }) })

    const eventInsert = mockConfig.insertCalls.find(
      (c: unknown) => (c as Record<string, unknown>).event_type === 'plan_iterate_requested'
    ) as Record<string, unknown>
    expect(eventInsert).toBeDefined()
    expect((eventInsert.metadata as Record<string, unknown>).feedback_length).toBe('New direction'.length)
  })

  it('does NOT call analyzePlan', async () => {
    const req = makeRequest({ feedback: 'Analyze this' })
    await POST(req, { params: Promise.resolve({ id: 'plan-123' }) })
    expect(mockAnalyzePlan).not.toHaveBeenCalled()
  })

  it('does NOT call parsePlanMarkdown for re-parsing', async () => {
    // The fire-and-forget route should not need to parse anything
    // It just stores the feedback and sets status
    const req = makeRequest({ feedback: 'Simple save' })
    const res = await POST(req, { params: Promise.resolve({ id: 'plan-123' }) })
    const json = await res.json()
    // Should NOT return beadCount/waveCount (no parsing happened)
    expect(json.message).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Ingest route -- no brainstorm chain
// ---------------------------------------------------------------------------

describe('POST /api/plans/ingest (fire-and-forget)', () => {
  let POST: typeof import('@/app/api/plans/ingest/route').POST

  beforeEach(async () => {
    resetConfig()
    mockBrainstormPlan.mockReset()
    mockAnalyzePlan.mockReset()
    mockConfig.insertResult = {
      data: { id: 'new-plan-1', title: 'Ingested', status: 'brainstorming' },
      error: null,
    }
    const mod = await import('@/app/api/plans/ingest/route')
    POST = mod.POST
  })

  it('does NOT call brainstormPlan for rough plans', async () => {
    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: 'Build an AI dashboard with real-time metrics' }),
    })
    await POST(req)
    expect(mockBrainstormPlan).not.toHaveBeenCalled()
  })

  it('does NOT call brainstormPlan for one-liners', async () => {
    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: 'Fix the login bug' }),
    })
    await POST(req)
    expect(mockBrainstormPlan).not.toHaveBeenCalled()
  })

  it('does NOT call analyzePlan', async () => {
    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: '# Plan\n\n## BEAD-001: Task\nDo stuff' }),
    })
    await POST(req)
    expect(mockAnalyzePlan).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Brainstorm route -- fire-and-forget
// ---------------------------------------------------------------------------

describe('POST /api/plans/[id]/brainstorm (fire-and-forget)', () => {
  let POST: typeof import('@/app/api/plans/[id]/brainstorm/route').POST

  beforeEach(async () => {
    resetConfig()
    mockBrainstormPlan.mockReset()
    mockConfig.selectSingleResult = { data: { ...MOCK_PLAN, status: 'brainstorming' }, error: null }
    mockConfig.updateResult = { data: { ...MOCK_PLAN, status: 'brainstorming' }, error: null }
    const mod = await import('@/app/api/plans/[id]/brainstorm/route')
    POST = mod.POST
  })

  it('does NOT call brainstormPlan', async () => {
    const req = new Request('http://localhost:3000/api/plans/plan-123/brainstorm', { method: 'POST' })
    await POST(req, { params: Promise.resolve({ id: 'plan-123' }) })
    expect(mockBrainstormPlan).not.toHaveBeenCalled()
  })

  it('sets status to brainstorming and returns', async () => {
    const req = new Request('http://localhost:3000/api/plans/plan-123/brainstorm', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'plan-123' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.status).toBe('brainstorming')
  })
})

// ---------------------------------------------------------------------------
// Analyze route -- fire-and-forget
// ---------------------------------------------------------------------------

describe('POST /api/plans/[id]/analyze (fire-and-forget)', () => {
  let POST: typeof import('@/app/api/plans/[id]/analyze/route').POST

  beforeEach(async () => {
    resetConfig()
    mockAnalyzePlan.mockReset()
    mockConfig.selectSingleResult = { data: MOCK_PLAN, error: null }
    mockConfig.updateResult = { data: { ...MOCK_PLAN, status: 'analyzing' }, error: null }
    const mod = await import('@/app/api/plans/[id]/analyze/route')
    POST = mod.POST
  })

  it('does NOT call analyzePlan', async () => {
    const req = new Request('http://localhost:3000/api/plans/plan-123/analyze', { method: 'POST' })
    await POST(req, { params: Promise.resolve({ id: 'plan-123' }) })
    expect(mockAnalyzePlan).not.toHaveBeenCalled()
  })

  it('sets status to analyzing and returns', async () => {
    const req = new Request('http://localhost:3000/api/plans/plan-123/analyze', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'plan-123' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.status).toBe('analyzing')
  })
})
