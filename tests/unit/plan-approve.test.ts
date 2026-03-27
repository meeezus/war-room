import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// BEAD-004: Plan Approval + Execution Bridge Tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Supabase mock — tracks calls per table, supports insert().select().single()
// ---------------------------------------------------------------------------

interface InsertCall {
  table: string
  data: unknown
}

interface UpdateCall {
  table: string
  data: unknown
  eqField: string
  eqValue: string
}

interface MockConfig {
  // Plan fetch result
  planFetchResult: { data: unknown; error: unknown }
  // Plan update result
  planUpdateResult: { error: unknown }
  // Mission insert results (consumed in order)
  missionInsertResults: Array<{ data: unknown; error: unknown }>
  // Task insert result
  taskInsertResult: { data: unknown; error: unknown }
  // Event insert result
  eventInsertResult: { data: unknown; error: unknown }
  // Tracking
  insertCalls: InsertCall[]
  updateCalls: UpdateCall[]
  fromCalls: string[]
}

let missionInsertIndex = 0

const mockConfig: MockConfig = {
  planFetchResult: { data: null, error: null },
  planUpdateResult: { error: null },
  missionInsertResults: [],
  taskInsertResult: { data: null, error: null },
  eventInsertResult: { data: null, error: null },
  insertCalls: [],
  updateCalls: [],
  fromCalls: [],
}

function resetConfig() {
  mockConfig.planFetchResult = { data: null, error: null }
  mockConfig.planUpdateResult = { error: null }
  mockConfig.missionInsertResults = []
  mockConfig.taskInsertResult = { data: null, error: null }
  mockConfig.eventInsertResult = { data: null, error: null }
  mockConfig.insertCalls = []
  mockConfig.updateCalls = []
  mockConfig.fromCalls = []
  missionInsertIndex = 0
}

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      mockConfig.fromCalls.push(table)
      const chain: Record<string, unknown> = {}

      chain.insert = (data: unknown) => {
        mockConfig.insertCalls.push({ table, data })
        if (table === 'missions') {
          const result =
            missionInsertIndex < mockConfig.missionInsertResults.length
              ? mockConfig.missionInsertResults[missionInsertIndex++]
              : { data: null, error: { message: 'No mock result' } }
          return {
            select: () => ({
              single: () => Promise.resolve(result),
            }),
          }
        }
        if (table === 'tasks') {
          return Promise.resolve(mockConfig.taskInsertResult)
        }
        // war_room_events
        return Promise.resolve(mockConfig.eventInsertResult)
      }

      chain.select = () => ({
        eq: () => ({
          single: () => Promise.resolve(mockConfig.planFetchResult),
        }),
      })

      chain.update = (data: unknown) => ({
        eq: (field: string, value: string) => {
          mockConfig.updateCalls.push({ table, data, eqField: field, eqValue: value })
          return Promise.resolve(mockConfig.planUpdateResult)
        },
      })

      return chain
    },
  }),
}))

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn(),
}))

vi.mock('@/lib/vault-sync', () => ({
  syncPlanToVault: vi.fn().mockResolvedValue(null),
}))

// ---------------------------------------------------------------------------
// Import the route handler
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/plans/[id]/approve/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'BEAD-001',
    title: 'Test bead',
    description: 'Do the thing',
    dependencies: [],
    blocks: [],
    size: 'M',
    accept: ['it works'],
    files: ['src/index.ts'],
    repo: 'war-room',
    domain: 'engineering',
    wave_index: 0,
    ...overrides,
  }
}

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-123',
    title: 'Test Plan',
    status: 'reviewing',
    parsed_beads: [makeBead()],
    wave_count: 1,
    created_at: '2026-03-26T00:00:00Z',
    updated_at: '2026-03-26T00:00:00Z',
    ...overrides,
  }
}

function makeRequest(id: string) {
  return new Request(`http://localhost:3000/api/plans/${id}/approve`, {
    method: 'POST',
  })
}

function makeRouteArgs(id: string): [Request, { params: Promise<{ id: string }> }] {
  return [
    makeRequest(id),
    { params: Promise.resolve({ id }) },
  ]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/plans/[id]/approve', () => {
  beforeEach(() => {
    resetConfig()
  })

  // --- Happy path ---

  it('approves a reviewing plan and creates wave 0 missions + tasks', async () => {
    const beads = [
      makeBead({ id: 'BEAD-001', title: 'First', domain: 'engineering', size: 'S', wave_index: 0 }),
      makeBead({ id: 'BEAD-002', title: 'Second', domain: 'product', size: 'M', wave_index: 0 }),
      makeBead({ id: 'BEAD-003', title: 'Third', domain: 'operations', size: 'L', wave_index: 0 }),
    ]
    const plan = makePlan({ parsed_beads: beads, wave_count: 2 })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [
      { data: { id: 'mission-1' }, error: null },
      { data: { id: 'mission-2' }, error: null },
      { data: { id: 'mission-3' }, error: null },
    ]

    const res = await POST(...makeRouteArgs('plan-123'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.missionsCreated).toBe(3)
    expect(json.wave).toBe(0)
    expect(json.totalBeads).toBe(3)
    expect(json.totalWaves).toBe(2)
  })

  it('only creates missions for wave 0 beads', async () => {
    const beads = [
      makeBead({ id: 'BEAD-001', wave_index: 0 }),
      makeBead({ id: 'BEAD-002', wave_index: 1 }),
      makeBead({ id: 'BEAD-003', wave_index: 2 }),
    ]
    const plan = makePlan({ parsed_beads: beads, wave_count: 3 })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [
      { data: { id: 'mission-1' }, error: null },
    ]

    const res = await POST(...makeRouteArgs('plan-123'))
    const json = await res.json()

    expect(json.missionsCreated).toBe(1)
    expect(json.totalBeads).toBe(3)
    // Only 1 mission insert (wave 0 bead)
    const missionInserts = mockConfig.insertCalls.filter(c => c.table === 'missions')
    expect(missionInserts).toHaveLength(1)
  })

  // --- Status validation ---

  it('rejects plan not in reviewing or approved status', async () => {
    const plan = makePlan({ status: 'draft' })
    mockConfig.planFetchResult = { data: plan, error: null }

    const res = await POST(...makeRouteArgs('plan-123'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/cannot approve/i)
  })

  it('allows re-execution of already approved plan', async () => {
    const plan = makePlan({ status: 'approved' })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [
      { data: { id: 'mission-1' }, error: null },
    ]

    const res = await POST(...makeRouteArgs('plan-123'))
    expect(res.status).toBe(200)
  })

  // --- Empty beads ---

  it('rejects plan with no beads', async () => {
    const plan = makePlan({ parsed_beads: [] })
    mockConfig.planFetchResult = { data: plan, error: null }

    const res = await POST(...makeRouteArgs('plan-123'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/no beads/i)
  })

  it('rejects plan with null parsed_beads', async () => {
    const plan = makePlan({ parsed_beads: null })
    mockConfig.planFetchResult = { data: plan, error: null }

    const res = await POST(...makeRouteArgs('plan-123'))
    expect(res.status).toBe(400)
  })

  // --- 404 ---

  it('returns 404 if plan not found', async () => {
    mockConfig.planFetchResult = { data: null, error: { message: 'not found' } }

    const res = await POST(...makeRouteArgs('nonexistent'))
    expect(res.status).toBe(404)
  })

  // --- Domain to daimyo mapping ---

  it('maps domain to correct daimyo', async () => {
    const beads = [
      makeBead({ id: 'BEAD-001', domain: 'engineering', wave_index: 0 }),
      makeBead({ id: 'BEAD-002', domain: 'strategy', wave_index: 0 }),
      makeBead({ id: 'BEAD-003', domain: 'operations', wave_index: 0 }),
      makeBead({ id: 'BEAD-004', domain: 'product', wave_index: 0 }),
      makeBead({ id: 'BEAD-005', domain: 'commerce', wave_index: 0 }),
    ]
    const plan = makePlan({ parsed_beads: beads, wave_count: 1 })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [
      { data: { id: 'm-1' }, error: null },
      { data: { id: 'm-2' }, error: null },
      { data: { id: 'm-3' }, error: null },
      { data: { id: 'm-4' }, error: null },
      { data: { id: 'm-5' }, error: null },
    ]

    await POST(...makeRouteArgs('plan-123'))

    const missionInserts = mockConfig.insertCalls.filter(c => c.table === 'missions')
    const daimyos = missionInserts.map(c => (c.data as Record<string, unknown>).assigned_to)
    expect(daimyos).toEqual(['ed', 'light', 'major', 'bulma', 'nanami'])
  })

  it('defaults to ed for unknown domain', async () => {
    const plan = makePlan({ parsed_beads: [makeBead({ domain: 'alien-tech' })] })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [{ data: { id: 'm-1' }, error: null }]

    await POST(...makeRouteArgs('plan-123'))

    const missionInserts = mockConfig.insertCalls.filter(c => c.table === 'missions')
    expect((missionInserts[0].data as Record<string, unknown>).assigned_to).toBe('ed')
  })

  // --- Size to timeout mapping ---

  it('maps bead size to correct timeout', async () => {
    const beads = [
      makeBead({ id: 'BEAD-S', size: 'S', wave_index: 0 }),
      makeBead({ id: 'BEAD-M', size: 'M', wave_index: 0 }),
      makeBead({ id: 'BEAD-L', size: 'L', wave_index: 0 }),
    ]
    const plan = makePlan({ parsed_beads: beads })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [
      { data: { id: 'm-s' }, error: null },
      { data: { id: 'm-m' }, error: null },
      { data: { id: 'm-l' }, error: null },
    ]

    await POST(...makeRouteArgs('plan-123'))

    const taskInserts = mockConfig.insertCalls.filter(c => c.table === 'tasks')
    const timeouts = taskInserts.map(c => (c.data as Record<string, unknown>).timeout_minutes)
    expect(timeouts).toEqual([15, 30, 60])
  })

  // --- Model mapping ---

  it('uses bead.model override when specified', async () => {
    const plan = makePlan({
      parsed_beads: [makeBead({ model: 'opus', wave_index: 0 })],
    })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [{ data: { id: 'm-1' }, error: null }]

    await POST(...makeRouteArgs('plan-123'))

    const taskInserts = mockConfig.insertCalls.filter(c => c.table === 'tasks')
    expect((taskInserts[0].data as Record<string, unknown>).model).toBe('claude-opus-4-6')
  })

  it('falls back to size-based model when bead.model is not set', async () => {
    const plan = makePlan({
      parsed_beads: [makeBead({ size: 'S', model: undefined, wave_index: 0 })],
    })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [{ data: { id: 'm-1' }, error: null }]

    await POST(...makeRouteArgs('plan-123'))

    const taskInserts = mockConfig.insertCalls.filter(c => c.table === 'tasks')
    expect((taskInserts[0].data as Record<string, unknown>).model).toBe('claude-haiku-4-5-20251001')
  })

  // --- Event emission ---

  it('emits plan_approved event to war_room_events', async () => {
    const plan = makePlan()
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [{ data: { id: 'm-1' }, error: null }]

    await POST(...makeRouteArgs('plan-123'))

    const eventInserts = mockConfig.insertCalls.filter(c => c.table === 'war_room_events')
    expect(eventInserts).toHaveLength(1)
    const eventData = eventInserts[0].data as Record<string, unknown>
    expect(eventData.event_type).toBe('plan_approved')
    expect(eventData.agent_id).toBe('system')
  })

  // --- Vault sync ---

  it('calls syncPlanToVault with running status', async () => {
    const { syncPlanToVault } = await import('@/lib/vault-sync')
    const plan = makePlan()
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [{ data: { id: 'm-1' }, error: null }]

    await POST(...makeRouteArgs('plan-123'))

    expect(syncPlanToVault).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'running' })
    )
  })

  // --- Task description assembly ---

  it('assembles task description with accept criteria and files', async () => {
    const bead = makeBead({
      description: 'Build the widget',
      accept: ['Widget renders', 'Tests pass'],
      files: ['src/widget.ts', 'tests/widget.test.ts'],
      wave_index: 0,
    })
    const plan = makePlan({ parsed_beads: [bead] })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [{ data: { id: 'm-1' }, error: null }]

    await POST(...makeRouteArgs('plan-123'))

    const taskInserts = mockConfig.insertCalls.filter(c => c.table === 'tasks')
    const desc = (taskInserts[0].data as Record<string, unknown>).description as string
    expect(desc).toContain('Build the widget')
    expect(desc).toContain('Acceptance criteria')
    expect(desc).toContain('Widget renders')
    expect(desc).toContain('Tests pass')
    expect(desc).toContain('src/widget.ts')
  })

  // --- Working dir ---

  it('sets working_dir from bead.repo', async () => {
    const plan = makePlan({
      parsed_beads: [makeBead({ repo: 'shogunate', wave_index: 0 })],
    })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [{ data: { id: 'm-1' }, error: null }]

    await POST(...makeRouteArgs('plan-123'))

    const taskInserts = mockConfig.insertCalls.filter(c => c.table === 'tasks')
    expect((taskInserts[0].data as Record<string, unknown>).working_dir).toBe('~/Code/shogunate')
  })

  it('sets working_dir to null when bead.repo is empty', async () => {
    const plan = makePlan({
      parsed_beads: [makeBead({ repo: '', wave_index: 0 })],
    })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [{ data: { id: 'm-1' }, error: null }]

    await POST(...makeRouteArgs('plan-123'))

    const taskInserts = mockConfig.insertCalls.filter(c => c.table === 'tasks')
    expect((taskInserts[0].data as Record<string, unknown>).working_dir).toBeNull()
  })

  // --- Plan status update ---

  it('updates plan status to running', async () => {
    const plan = makePlan()
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [{ data: { id: 'm-1' }, error: null }]

    await POST(...makeRouteArgs('plan-123'))

    const planUpdates = mockConfig.updateCalls.filter(c => c.table === 'plans')
    expect(planUpdates).toHaveLength(1)
    expect((planUpdates[0].data as Record<string, unknown>).status).toBe('running')
  })

  // --- Mission insert failure skips gracefully ---

  it('continues when a mission insert fails', async () => {
    const beads = [
      makeBead({ id: 'BEAD-001', wave_index: 0 }),
      makeBead({ id: 'BEAD-002', wave_index: 0 }),
    ]
    const plan = makePlan({ parsed_beads: beads })
    mockConfig.planFetchResult = { data: plan, error: null }
    mockConfig.missionInsertResults = [
      { data: null, error: { message: 'insert failed' } },
      { data: { id: 'm-2' }, error: null },
    ]

    const res = await POST(...makeRouteArgs('plan-123'))
    const json = await res.json()

    // Should still succeed with 1 mission
    expect(res.status).toBe(200)
    expect(json.missionsCreated).toBe(1)
  })
})
