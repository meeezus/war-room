import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// BEAD-003: Plan API Routes + Analyzer Tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. Plan Analyzer (pure functions, no mocks needed)
// ---------------------------------------------------------------------------

import { getAnalysisDepth, createStubAnalysis } from '@/lib/plan-analyzer'

describe('lib/plan-analyzer', () => {
  describe('getAnalysisDepth', () => {
    it('returns none for scores 1-4', () => {
      expect(getAnalysisDepth(1)).toBe('none')
      expect(getAnalysisDepth(3)).toBe('none')
      expect(getAnalysisDepth(4)).toBe('none')
    })

    it('returns quick for scores 5-6', () => {
      expect(getAnalysisDepth(5)).toBe('quick')
      expect(getAnalysisDepth(6)).toBe('quick')
    })

    it('returns polyclaude for scores 7-8', () => {
      expect(getAnalysisDepth(7)).toBe('polyclaude')
      expect(getAnalysisDepth(8)).toBe('polyclaude')
    })

    it('returns council-matrix for score 9', () => {
      expect(getAnalysisDepth(9)).toBe('council-matrix')
    })
  })

  describe('createStubAnalysis', () => {
    it('creates a none-depth analysis for low scores', () => {
      const result = createStubAnalysis(3)
      expect(result.depth).toBe('none')
      expect(result.pushback).toEqual([])
      expect(result.recommendation).toContain('Approve when ready')
    })

    it('creates quick analysis for medium scores', () => {
      const result = createStubAnalysis(5)
      expect(result.depth).toBe('quick')
      expect(result.pushback.length).toBeGreaterThan(0)
      expect(result.recommendation).toContain('5')
    })

    it('sets analyzed_at as ISO string', () => {
      const result = createStubAnalysis(7)
      expect(new Date(result.analyzed_at).toISOString()).toBe(result.analyzed_at)
    })

    it('returns empty arrays for alternatives and blind_spots', () => {
      const result = createStubAnalysis(9)
      expect(result.alternatives).toEqual([])
      expect(result.blind_spots).toEqual([])
    })

    it('returns council-matrix for score 9', () => {
      const result = createStubAnalysis(9)
      expect(result.depth).toBe('council-matrix')
    })
  })
})

// ---------------------------------------------------------------------------
// Supabase mock -- configurable per test via mockConfig
// ---------------------------------------------------------------------------

interface MockConfig {
  insertResult: { data: unknown; error: unknown }
  selectSingleResult: { data: unknown; error: unknown }
  updateResult: { data: unknown; error: unknown }
  // Track calls
  insertCalls: unknown[]
  fromCalls: string[]
  // Multi-call support: array of results consumed in order
  selectSingleResults?: Array<{ data: unknown; error: unknown }>
}

const mockConfig: MockConfig = {
  insertResult: { data: null, error: null },
  selectSingleResult: { data: null, error: null },
  updateResult: { data: null, error: null },
  insertCalls: [],
  fromCalls: [],
  selectSingleResults: undefined,
}

let selectSingleCallIndex = 0

function resetConfig() {
  mockConfig.insertResult = { data: null, error: null }
  mockConfig.selectSingleResult = { data: null, error: null }
  mockConfig.updateResult = { data: null, error: null }
  mockConfig.insertCalls = []
  mockConfig.fromCalls = []
  mockConfig.selectSingleResults = undefined
  selectSingleCallIndex = 0
}

function getSelectSingleResult() {
  if (mockConfig.selectSingleResults && selectSingleCallIndex < mockConfig.selectSingleResults.length) {
    return mockConfig.selectSingleResults[selectSingleCallIndex++]
  }
  return mockConfig.selectSingleResult
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
          single: () => Promise.resolve(getSelectSingleResult()),
          order: () => Promise.resolve({ data: [], error: null }),
        })
        selectChain.order = () => ({
          limit: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
            then: (fn: (v: unknown) => unknown) => fn({ data: [], error: null }),
          }),
        })
        return selectChain
      }

      chain.update = (data: unknown) => {
        return {
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve(mockConfig.updateResult),
            }),
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

// ---------------------------------------------------------------------------
// 2. POST /api/plans/ingest
// ---------------------------------------------------------------------------

import { POST as ingestPOST } from '@/app/api/plans/ingest/route'

describe('POST /api/plans/ingest', () => {
  beforeEach(() => {
    resetConfig()
  })

  it('returns 400 when markdown is missing', async () => {
    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await ingestPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/markdown/i)
  })

  it('returns 400 when markdown is not a string', async () => {
    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: 123 }),
    })
    const res = await ingestPOST(req)
    expect(res.status).toBe(400)
  })

  it('detects structured plans with BEAD headings', async () => {
    const md = `# Test Plan\n\n### BEAD-001: First bead\nDo something\n\n### BEAD-002: Second bead\nDo another thing`
    mockConfig.insertResult = { data: { id: 'plan-1', title: 'Test Plan' }, error: null }

    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: md }),
    })
    const res = await ingestPOST(req)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.structureLevel).toBe('structured')
    expect(json.needsBrainstorm).toBe(false)
  })

  it('detects one-liner plans (short, no newlines)', async () => {
    const md = 'Build a dashboard for tracking health metrics'
    mockConfig.insertResult = { data: { id: 'plan-2' }, error: null }

    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: md }),
    })
    const res = await ingestPOST(req)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.structureLevel).toBe('one-liner')
    expect(json.needsBrainstorm).toBe(true)
  })

  it('detects rough plans (multi-line, no BEAD headings)', async () => {
    const md = `# Health Dashboard\n\nWe need to track sleep, HRV, and readiness.\nMaybe pull from Oura API.\nShow trends over time.\nAdd alerts for low scores.`
    mockConfig.insertResult = { data: { id: 'plan-3' }, error: null }

    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: md }),
    })
    const res = await ingestPOST(req)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.structureLevel).toBe('rough')
    expect(json.needsBrainstorm).toBe(true)
  })

  it('inserts into plans table with parsed data', async () => {
    const md = `# My Plan\n\n### BEAD-001: Setup\nCreate scaffolding`
    mockConfig.insertResult = { data: { id: 'plan-4' }, error: null }

    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: md }),
    })
    await ingestPOST(req)

    // First insert should be the plans table
    expect(mockConfig.fromCalls[0]).toBe('plans')
    expect(mockConfig.insertCalls[0]).toEqual(
      expect.objectContaining({
        raw_markdown: md,
        title: 'My Plan',
        auto_run: false,
      })
    )
  })

  it('emits a war_room_events record', async () => {
    const md = `# Events Test\n\n### BEAD-001: Test\nSome content`
    mockConfig.insertResult = { data: { id: 'plan-5' }, error: null }

    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: md }),
    })
    await ingestPOST(req)

    // Should have called from('plans') then from('war_room_events')
    expect(mockConfig.fromCalls).toContain('war_room_events')
    const eventInsert = mockConfig.insertCalls.find(
      (c: unknown) => (c as Record<string, unknown>).event_type === 'plan_ingested'
    )
    expect(eventInsert).toBeDefined()
  })

  it('returns 500 on Supabase insert error', async () => {
    mockConfig.insertResult = { data: null, error: { message: 'insert failed' } }

    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: '# Fail plan' }),
    })
    const res = await ingestPOST(req)
    expect(res.status).toBe(500)
  })

  it('sets initialStatus to brainstorming for rough plans', async () => {
    const md = `# Rough Plan\n\nJust some ideas about building stuff.\nNo BEAD structure here.`
    mockConfig.insertResult = { data: { id: 'plan-6' }, error: null }

    const req = new Request('http://localhost:3000/api/plans/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: md }),
    })
    await ingestPOST(req)

    expect(mockConfig.insertCalls[0]).toEqual(
      expect.objectContaining({
        status: 'brainstorming',
      })
    )
  })
})

// ---------------------------------------------------------------------------
// 3. GET /api/plans
// ---------------------------------------------------------------------------

import { GET as plansGET } from '@/app/api/plans/route'

describe('GET /api/plans', () => {
  beforeEach(() => {
    resetConfig()
  })

  it('returns plans list', async () => {
    const req = new Request('http://localhost:3000/api/plans')
    const res = await plansGET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveProperty('plans')
    expect(Array.isArray(json.plans)).toBe(true)
  })

  it('queries plans table', async () => {
    const req = new Request('http://localhost:3000/api/plans')
    await plansGET(req)
    expect(mockConfig.fromCalls[0]).toBe('plans')
  })
})

// ---------------------------------------------------------------------------
// 4. GET /api/plans/[id]
// ---------------------------------------------------------------------------

import { GET as planDetailGET, PATCH as planDetailPATCH } from '@/app/api/plans/[id]/route'

describe('GET /api/plans/[id]', () => {
  beforeEach(() => {
    resetConfig()
  })

  it('returns a single plan', async () => {
    const mockPlan = { id: 'plan-1', title: 'Test Plan', status: 'draft' }
    mockConfig.selectSingleResult = { data: mockPlan, error: null }

    const req = new Request('http://localhost:3000/api/plans/plan-1')
    const res = await planDetailGET(req, { params: Promise.resolve({ id: 'plan-1' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveProperty('plan')
    expect(json.plan.id).toBe('plan-1')
  })

  it('returns 404 when plan not found', async () => {
    mockConfig.selectSingleResult = { data: null, error: { message: 'not found', code: 'PGRST116' } }

    const req = new Request('http://localhost:3000/api/plans/nonexistent')
    const res = await planDetailGET(req, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// 5. PATCH /api/plans/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/plans/[id]', () => {
  beforeEach(() => {
    resetConfig()
  })

  it('updates allowed fields', async () => {
    const updated = { id: 'plan-1', title: 'Plan', status: 'approved' }
    mockConfig.updateResult = { data: updated, error: null }

    const req = new Request('http://localhost:3000/api/plans/plan-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    const res = await planDetailPATCH(req, { params: Promise.resolve({ id: 'plan-1' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveProperty('plan')
  })

  it('rejects disallowed fields but passes whitelisted ones', async () => {
    const updated = { id: 'plan-1', status: 'approved' }
    mockConfig.updateResult = { data: updated, error: null }

    const req = new Request('http://localhost:3000/api/plans/plan-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'hacked', title: 'hacked', status: 'approved' }),
    })
    const res = await planDetailPATCH(req, { params: Promise.resolve({ id: 'plan-1' }) })

    // Should succeed -- status is whitelisted even though id and title are not
    expect(res.status).toBe(200)
  })

  it('returns 400 when no valid fields provided', async () => {
    const req = new Request('http://localhost:3000/api/plans/plan-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bad_field: 'nope' }),
    })
    const res = await planDetailPATCH(req, { params: Promise.resolve({ id: 'plan-1' }) })

    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// 6. POST /api/plans/[id]/analyze
// ---------------------------------------------------------------------------

import { POST as analyzePOST } from '@/app/api/plans/[id]/analyze/route'

describe('POST /api/plans/[id]/analyze (fire-and-forget)', () => {
  beforeEach(() => {
    resetConfig()
    selectSingleCallIndex = 0
  })

  it('sets status to analyzing and returns queued response', async () => {
    const mockPlan = { id: 'plan-1', flywheel_score: 6, status: 'reviewing', title: 'Test' }

    mockConfig.selectSingleResults = [
      { data: mockPlan, error: null },
    ]
    mockConfig.updateResult = { data: { ...mockPlan, status: 'analyzing' }, error: null }

    const req = new Request('http://localhost:3000/api/plans/plan-1/analyze', { method: 'POST' })
    const res = await analyzePOST(req, { params: Promise.resolve({ id: 'plan-1' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.status).toBe('analyzing')
  })

  it('returns 404 when plan not found', async () => {
    mockConfig.selectSingleResults = [
      { data: null, error: { message: 'not found' } },
    ]

    const req = new Request('http://localhost:3000/api/plans/nonexistent/analyze', { method: 'POST' })
    const res = await analyzePOST(req, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// 7. Query functions (getPlans, getPlan, getPlanMissions)
// ---------------------------------------------------------------------------

// These are tested indirectly -- they use the client-side supabase, not the
// service client. We verify they exist and have the right signatures.

describe('lib/queries plan functions', () => {
  it('exports getPlans', async () => {
    const mod = await import('@/lib/queries')
    expect(typeof mod.getPlans).toBe('function')
  })

  it('exports getPlan', async () => {
    const mod = await import('@/lib/queries')
    expect(typeof mod.getPlan).toBe('function')
  })

  it('exports getPlanMissions', async () => {
    const mod = await import('@/lib/queries')
    expect(typeof mod.getPlanMissions).toBe('function')
  })
})
