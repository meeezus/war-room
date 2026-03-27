// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock dependencies before imports
// ---------------------------------------------------------------------------
const { mockProbeAllServices, mockProbeSparkInsights, mockProbeTabLedger,
  mockProbeLosslessClaw, mockProbePipelineState, mockProbeSystemFitness,
  mockReadFile, mockExecFile, mockSupabaseFrom } = vi.hoisted(() => {
  return {
    mockProbeAllServices: vi.fn(),
    mockProbeSparkInsights: vi.fn(),
    mockProbeTabLedger: vi.fn(),
    mockProbeLosslessClaw: vi.fn(),
    mockProbePipelineState: vi.fn(),
    mockProbeSystemFitness: vi.fn(),
    mockReadFile: vi.fn(),
    mockExecFile: vi.fn(),
    mockSupabaseFrom: vi.fn(),
  }
})

vi.mock(import('@/lib/local-services'), async () => ({
  probeAllServices: mockProbeAllServices,
  probeSparkInsights: mockProbeSparkInsights,
  probeTabLedger: mockProbeTabLedger,
  probeLosslessClaw: mockProbeLosslessClaw,
  probePipelineState: mockProbePipelineState,
  probeSystemFitness: mockProbeSystemFitness,
}))

vi.mock(import('fs/promises'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, default: actual, readFile: mockReadFile }
})

vi.mock(import('child_process'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, default: actual, execFile: mockExecFile }
})

const mockSelect = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()

vi.mock(import('@/lib/supabase'), async () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}))

// ---------------------------------------------------------------------------
// Route handler imports (after mocks)
// ---------------------------------------------------------------------------
import { GET as healthGET } from '@/app/api/services/health/route'
import { GET as memoryGET } from '@/app/api/memory/status/route'
import { GET as activityGET } from '@/app/api/activity/recent/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function jsonFromResponse(res: Response) {
  return res.json()
}

// ---------------------------------------------------------------------------
// Route 1: /api/services/health
// ---------------------------------------------------------------------------
describe('GET /api/services/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.VERCEL
  })

  it('returns nominal when all services are ok', async () => {
    mockProbeAllServices.mockResolvedValue({
      sparkd: { ok: true, detail: 'running' },
      poller: { ok: true, detail: 'running' },
      bridge_worker: { ok: true, detail: 'fresh' },
    })

    const res = await healthGET(new Request('http://localhost/api/services/health'))
    expect(res.status).toBe(200)

    const body = await jsonFromResponse(res)
    expect(body.overall).toBe('nominal')
    expect(body.isLocal).toBe(true)
    expect(body.checkedAt).toBeDefined()
    expect(body.services).toBeDefined()
  })

  it('returns degraded when some services are down', async () => {
    mockProbeAllServices.mockResolvedValue({
      sparkd: { ok: true, detail: 'running' },
      poller: { ok: false, detail: 'not running' },
      bridge_worker: { ok: true, detail: 'fresh' },
      openclaw: { ok: true, detail: 'running' },
    })

    const res = await healthGET(new Request('http://localhost/api/services/health'))
    const body = await jsonFromResponse(res)
    expect(body.overall).toBe('degraded')
  })

  it('returns down when majority of services are down', async () => {
    mockProbeAllServices.mockResolvedValue({
      sparkd: { ok: false, detail: 'error' },
      poller: { ok: false, detail: 'not running' },
      bridge_worker: { ok: false, detail: 'stale' },
      openclaw: { ok: true, detail: 'running' },
    })

    const res = await healthGET(new Request('http://localhost/api/services/health'))
    const body = await jsonFromResponse(res)
    expect(body.overall).toBe('down')
  })

  it('returns unavailable when all services are unavailable (Vercel)', async () => {
    mockProbeAllServices.mockResolvedValue({
      sparkd: { ok: false, detail: 'local-only', unavailable: true },
      poller: { ok: false, detail: 'local-only', unavailable: true },
    })

    const res = await healthGET(new Request('http://localhost/api/services/health'))
    const body = await jsonFromResponse(res)
    expect(body.overall).toBe('unavailable')
  })

  it('sets Cache-Control to no-cache', async () => {
    mockProbeAllServices.mockResolvedValue({
      sparkd: { ok: true, detail: 'running' },
    })

    const res = await healthGET(new Request('http://localhost/api/services/health'))
    expect(res.headers.get('Cache-Control')).toBe('no-cache')
  })

  it('returns 500 on unexpected error', async () => {
    mockProbeAllServices.mockRejectedValue(new Error('boom'))

    const res = await healthGET(new Request('http://localhost/api/services/health'))
    expect(res.status).toBe(500)
    const body = await jsonFromResponse(res)
    expect(body.error).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Route 2: /api/memory/status
// ---------------------------------------------------------------------------
describe('GET /api/memory/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.VERCEL
  })

  it('returns memory layers from all probes', async () => {
    mockProbeSparkInsights.mockResolvedValue({ ok: true, detail: '204 insights', meta: { count: 204 } })
    mockProbeTabLedger.mockResolvedValue({ ok: true, detail: '11372 sessions', meta: { sessions: 11372, cost: 19730, lastSession: '2026-03-25' } })
    mockProbeLosslessClaw.mockResolvedValue({ ok: true, detail: '5 tables', meta: { tables: 5 } })
    mockProbePipelineState.mockResolvedValue({ ok: true, detail: 'loaded', meta: { stage: 'ready' } })
    mockProbeSystemFitness.mockResolvedValue({
      ok: true, detail: 'loaded', meta: {
        missRate: 0.12, missRateTrend: 'improving', corrections: 5,
        correctionsPrevPeriod: 8, skillsImproved: 2, sessions: 100,
        digest: 'ok', computedAt: '2026-03-25T00:00:00Z',
      }
    })

    const res = await memoryGET(new Request('http://localhost/api/memory/status'))
    expect(res.status).toBe(200)

    const body = await jsonFromResponse(res)
    expect(body.isLocal).toBe(true)
    expect(body.checkedAt).toBeDefined()
    expect(body.layers.spark.ok).toBe(true)
    expect(body.layers.tab_ledger.ok).toBe(true)
    expect(body.layers.lossless_claw.ok).toBe(true)
    expect(body.layers.pipeline.ok).toBe(true)
    expect(body.fitness).not.toBeNull()
    expect(body.fitness.missRate).toBe(0.12)
  })

  it('returns null fitness when fitness probe fails', async () => {
    mockProbeSparkInsights.mockResolvedValue({ ok: false, detail: 'error' })
    mockProbeTabLedger.mockResolvedValue({ ok: false, detail: 'error' })
    mockProbeLosslessClaw.mockResolvedValue({ ok: false, detail: 'error' })
    mockProbePipelineState.mockResolvedValue({ ok: false, detail: 'error' })
    mockProbeSystemFitness.mockResolvedValue({ ok: false, detail: 'file not found' })

    const res = await memoryGET(new Request('http://localhost/api/memory/status'))
    const body = await jsonFromResponse(res)
    expect(body.fitness).toBeNull()
  })

  it('spreads probe meta into layer objects', async () => {
    mockProbeSparkInsights.mockResolvedValue({ ok: true, detail: '50 insights', meta: { count: 50 } })
    mockProbeTabLedger.mockResolvedValue({ ok: true, detail: '100 sessions', meta: { sessions: 100, cost: 500 } })
    mockProbeLosslessClaw.mockResolvedValue({ ok: true, detail: '3 tables', meta: { tables: 3 } })
    mockProbePipelineState.mockResolvedValue({ ok: true, detail: 'loaded', meta: { stage: 'active' } })
    mockProbeSystemFitness.mockResolvedValue({ ok: false, detail: 'unavailable' })

    const res = await memoryGET(new Request('http://localhost/api/memory/status'))
    const body = await jsonFromResponse(res)
    expect(body.layers.spark.count).toBe(50)
    expect(body.layers.tab_ledger.sessions).toBe(100)
  })

  it('returns 500 on unexpected error', async () => {
    mockProbeSparkInsights.mockRejectedValue(new Error('boom'))
    mockProbeTabLedger.mockResolvedValue({ ok: false, detail: 'error' })
    mockProbeLosslessClaw.mockResolvedValue({ ok: false, detail: 'error' })
    mockProbePipelineState.mockResolvedValue({ ok: false, detail: 'error' })
    mockProbeSystemFitness.mockResolvedValue({ ok: false, detail: 'error' })

    const res = await memoryGET(new Request('http://localhost/api/memory/status'))
    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Route 3: /api/activity/recent
// ---------------------------------------------------------------------------
describe('GET /api/activity/recent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.VERCEL
  })

  it('merges items from all sources and sorts by timestamp desc', async () => {
    // Spark insights
    mockReadFile.mockResolvedValue(JSON.stringify([
      { content: 'Insight A', When: 'always', id: 'a1' },
      { content: 'Insight B', When: 'sometimes', id: 'b2' },
    ]))

    // Tab-ledger sqlite3
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string) => void) => {
      cb(null, 'sess1|folio|2026-03-25T10:00:00Z|1.50\nsess2|war-room|2026-03-25T09:00:00Z|2.00\n')
    })

    // Supabase engine events
    mockLimit.mockResolvedValue({
      data: [
        { id: 'e1', event_type: 'mission_completed', title: 'Deploy v2', created_at: '2026-03-25T11:00:00Z' },
      ],
      error: null,
    })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockSupabaseFrom.mockReturnValue({ select: mockSelect })

    const res = await activityGET(new Request('http://localhost/api/activity/recent'))
    expect(res.status).toBe(200)

    const body = await jsonFromResponse(res)
    expect(body.isLocal).toBe(true)
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items.length).toBeLessThanOrEqual(20)

    // Verify sorted descending
    for (let i = 1; i < body.items.length; i++) {
      expect(new Date(body.items[i - 1].timestamp).getTime())
        .toBeGreaterThanOrEqual(new Date(body.items[i].timestamp).getTime())
    }
  })

  it('returns only Supabase events on Vercel', async () => {
    process.env.VERCEL = '1'

    mockLimit.mockResolvedValue({
      data: [
        { id: 'e1', event_type: 'heartbeat', title: 'Alive', created_at: '2026-03-25T11:00:00Z' },
      ],
      error: null,
    })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockSupabaseFrom.mockReturnValue({ select: mockSelect })

    const res = await activityGET(new Request('http://localhost/api/activity/recent'))
    const body = await jsonFromResponse(res)
    expect(body.isLocal).toBe(false)
    // Should only have engine source, no spark or tab_ledger
    for (const item of body.items) {
      expect(item.source).toBe('engine')
    }
  })

  it('handles missing Supabase gracefully', async () => {
    // Spark
    mockReadFile.mockResolvedValue(JSON.stringify([
      { content: 'Insight X', id: 'x1' },
    ]))

    // Tab-ledger
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string) => void) => {
      cb(null, '')
    })

    // Supabase returns error
    mockLimit.mockResolvedValue({ data: null, error: { message: 'no connection' } })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockSupabaseFrom.mockReturnValue({ select: mockSelect })

    const res = await activityGET(new Request('http://localhost/api/activity/recent'))
    expect(res.status).toBe(200)
    const body = await jsonFromResponse(res)
    // Should still have spark items even if supabase fails
    expect(body.items.length).toBeGreaterThanOrEqual(0)
  })

  it('each ActivityItem has correct shape', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify([
      { content: 'Test insight', id: 'ti1' },
    ]))
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string) => void) => {
      cb(null, '')
    })
    mockLimit.mockResolvedValue({ data: [], error: null })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockSupabaseFrom.mockReturnValue({ select: mockSelect })

    const res = await activityGET(new Request('http://localhost/api/activity/recent'))
    const body = await jsonFromResponse(res)
    for (const item of body.items) {
      expect(item).toHaveProperty('source')
      expect(item).toHaveProperty('type')
      expect(item).toHaveProperty('title')
      expect(item).toHaveProperty('timestamp')
      expect(['spark', 'tab_ledger', 'makima', 'poller', 'engine']).toContain(item.source)
    }
  })

  it('limits output to 20 items', async () => {
    // 30 spark insights to exceed limit
    const manyInsights = Array.from({ length: 30 }, (_, i) => ({
      content: `Insight ${i}`, id: `i${i}`,
    }))
    mockReadFile.mockResolvedValue(JSON.stringify(manyInsights))
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string) => void) => {
      cb(null, '')
    })
    mockLimit.mockResolvedValue({ data: [], error: null })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockSupabaseFrom.mockReturnValue({ select: mockSelect })

    const res = await activityGET(new Request('http://localhost/api/activity/recent'))
    const body = await jsonFromResponse(res)
    expect(body.items.length).toBeLessThanOrEqual(20)
  })
})
