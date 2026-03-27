import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// BEAD-005: Wave Advancement Cron Tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Supabase mock — tracks all calls for assertion
// ---------------------------------------------------------------------------

interface MockPlan {
  id: string
  title: string
  parsed_beads: unknown[]
  wave_count: number
  status: string
}

interface MockMission {
  id: string
  status: string
  wave_index: number
}

interface MockState {
  plans: MockPlan[]
  missions: Record<string, MockMission[]> // keyed by plan_id
  insertCalls: Array<{ table: string; data: unknown }>
  updateCalls: Array<{ table: string; data: unknown; filters: Record<string, unknown> }>
  selectCalls: string[]
}

const mockState: MockState = {
  plans: [],
  missions: {},
  insertCalls: [],
  updateCalls: [],
  selectCalls: [],
}

function resetState() {
  mockState.plans = []
  mockState.missions = {}
  mockState.insertCalls = []
  mockState.updateCalls = []
  mockState.selectCalls = []
}

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      mockState.selectCalls.push(table)
      const chain: Record<string, unknown> = {}

      chain.select = (cols?: string) => {
        const selectChain: Record<string, unknown> = {}

        selectChain.eq = (col: string, val: unknown) => {
          if (table === 'plans' && col === 'status' && val === 'running') {
            return Promise.resolve({ data: mockState.plans, error: null })
          }
          if (table === 'missions' && col === 'plan_id') {
            return Promise.resolve({ data: mockState.missions[val as string] ?? [], error: null })
          }
          return Promise.resolve({ data: [], error: null })
        }

        selectChain.single = () => Promise.resolve({ data: null, error: null })

        return selectChain
      }

      chain.insert = (data: unknown) => {
        mockState.insertCalls.push({ table, data })
        // For mission insert that needs to return id
        if (table === 'missions') {
          const missionId = `mission-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          return {
            select: (cols?: string) => ({
              single: () => Promise.resolve({ data: { id: missionId }, error: null }),
            }),
          }
        }
        return {
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }
      }

      chain.update = (data: unknown) => {
        const updateObj: MockState['updateCalls'][number] = { table, data, filters: {} }
        mockState.updateCalls.push(updateObj)
        return {
          eq: (col: string, val: unknown) => {
            updateObj.filters[col] = val
            return Promise.resolve({ data: null, error: null })
          },
        }
      }

      return chain
    },
  }),
}))

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn(),
  captureWarning: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Import the route handler under test
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/cron/plan-waves/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBead(overrides: Partial<{
  id: string; title: string; description: string; dependencies: string[];
  blocks: string[]; size: string; accept: string[]; files: string[];
  repo: string; domain: string; wave_index: number; model: string;
}> = {}) {
  return {
    id: overrides.id ?? 'BEAD-001',
    title: overrides.title ?? 'Test bead',
    description: overrides.description ?? 'Do something',
    dependencies: overrides.dependencies ?? [],
    blocks: overrides.blocks ?? [],
    size: overrides.size ?? 'M',
    accept: overrides.accept ?? ['It works'],
    files: overrides.files ?? ['lib/foo.ts'],
    repo: overrides.repo ?? 'war-room',
    domain: overrides.domain ?? 'engineering',
    wave_index: overrides.wave_index ?? 0,
    model: overrides.model ?? 'sonnet',
  }
}

function makeRequest() {
  return new Request('http://localhost:3000/api/cron/plan-waves', { method: 'GET' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/plan-waves', () => {
  beforeEach(() => {
    resetState()
  })

  // -------------------------------------------------------------------------
  // 1. No running plans
  // -------------------------------------------------------------------------
  it('returns 0 advanced/completed when no running plans exist', async () => {
    mockState.plans = []

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.advanced).toBe(0)
    expect(json.completed).toBe(0)
  })

  // -------------------------------------------------------------------------
  // 2. Wave 0 still running — no advancement
  // -------------------------------------------------------------------------
  it('does NOT advance when current wave has running missions', async () => {
    mockState.plans = [{
      id: 'plan-1', title: 'Test Plan', wave_count: 2, status: 'running',
      parsed_beads: [
        makeBead({ id: 'BEAD-001', wave_index: 0 }),
        makeBead({ id: 'BEAD-002', wave_index: 1 }),
      ],
    }]
    mockState.missions['plan-1'] = [
      { id: 'm1', status: 'completed', wave_index: 0 },
      { id: 'm2', status: 'running', wave_index: 0 },
    ]

    const res = await GET()
    const json = await res.json()

    expect(json.advanced).toBe(0)
    expect(json.completed).toBe(0)
    // No mission inserts should have happened
    const missionInserts = mockState.insertCalls.filter(c => c.table === 'missions')
    expect(missionInserts).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // 3. All wave 0 completed → wave 1 missions created
  // -------------------------------------------------------------------------
  it('advances to wave 1 when all wave 0 missions are terminal', async () => {
    const wave1Bead = makeBead({
      id: 'BEAD-003', title: 'Wave 1 task', wave_index: 1, domain: 'engineering',
    })
    mockState.plans = [{
      id: 'plan-1', title: 'Test Plan', wave_count: 2, status: 'running',
      parsed_beads: [
        makeBead({ id: 'BEAD-001', wave_index: 0 }),
        makeBead({ id: 'BEAD-002', wave_index: 0 }),
        wave1Bead,
      ],
    }]
    mockState.missions['plan-1'] = [
      { id: 'm1', status: 'completed', wave_index: 0 },
      { id: 'm2', status: 'completed', wave_index: 0 },
    ]

    const res = await GET()
    const json = await res.json()

    expect(json.advanced).toBe(1)
    expect(json.completed).toBe(0)

    // Should have inserted a mission for wave 1
    const missionInserts = mockState.insertCalls.filter(c => c.table === 'missions')
    expect(missionInserts.length).toBeGreaterThanOrEqual(1)
    const insertedMission = missionInserts[0].data as Record<string, unknown>
    expect(insertedMission.plan_id).toBe('plan-1')
    expect(insertedMission.wave_index).toBe(1)
    expect(insertedMission.status).toBe('queued')

    // Should have inserted tasks
    const taskInserts = mockState.insertCalls.filter(c => c.table === 'tasks')
    expect(taskInserts.length).toBeGreaterThanOrEqual(1)

    // Should have emitted a plan_wave_completed event
    const eventInserts = mockState.insertCalls.filter(c => c.table === 'war_room_events')
    expect(eventInserts.length).toBeGreaterThanOrEqual(1)
    const waveEvent = eventInserts.find(e =>
      (e.data as Record<string, unknown>).event_type === 'plan_wave_completed'
    )
    expect(waveEvent).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // 4. All waves completed → plan marked completed
  // -------------------------------------------------------------------------
  it('marks plan as completed when all waves are done and all missions succeeded', async () => {
    mockState.plans = [{
      id: 'plan-1', title: 'Test Plan', wave_count: 1, status: 'running',
      parsed_beads: [
        makeBead({ id: 'BEAD-001', wave_index: 0 }),
      ],
    }]
    mockState.missions['plan-1'] = [
      { id: 'm1', status: 'completed', wave_index: 0 },
    ]

    const res = await GET()
    const json = await res.json()

    expect(json.completed).toBe(1)
    expect(json.advanced).toBe(0)

    // Plan should be updated to 'completed'
    const planUpdate = mockState.updateCalls.find(c => c.table === 'plans')
    expect(planUpdate).toBeDefined()
    expect((planUpdate!.data as Record<string, unknown>).status).toBe('completed')
    expect(planUpdate!.filters['id']).toBe('plan-1')

    // Should have emitted a plan_completed event
    const eventInserts = mockState.insertCalls.filter(c => c.table === 'war_room_events')
    const completedEvent = eventInserts.find(e =>
      (e.data as Record<string, unknown>).event_type === 'plan_completed'
    )
    expect(completedEvent).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // 5. Some missions failed → plan marked failed
  // -------------------------------------------------------------------------
  it('marks plan as failed if any mission in the final wave failed', async () => {
    mockState.plans = [{
      id: 'plan-1', title: 'Test Plan', wave_count: 1, status: 'running',
      parsed_beads: [
        makeBead({ id: 'BEAD-001', wave_index: 0 }),
        makeBead({ id: 'BEAD-002', wave_index: 0 }),
      ],
    }]
    mockState.missions['plan-1'] = [
      { id: 'm1', status: 'completed', wave_index: 0 },
      { id: 'm2', status: 'failed', wave_index: 0 },
    ]

    const res = await GET()
    const json = await res.json()

    expect(json.completed).toBe(1)

    // Plan should be updated to 'failed'
    const planUpdate = mockState.updateCalls.find(c => c.table === 'plans')
    expect(planUpdate).toBeDefined()
    expect((planUpdate!.data as Record<string, unknown>).status).toBe('failed')

    // Should have emitted a plan_failed event
    const eventInserts = mockState.insertCalls.filter(c => c.table === 'war_room_events')
    const failedEvent = eventInserts.find(e =>
      (e.data as Record<string, unknown>).event_type === 'plan_failed'
    )
    expect(failedEvent).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // 6. Domain-to-daimyo mapping
  // -------------------------------------------------------------------------
  it('maps domain to correct daimyo when creating missions', async () => {
    mockState.plans = [{
      id: 'plan-1', title: 'Test Plan', wave_count: 2, status: 'running',
      parsed_beads: [
        makeBead({ id: 'BEAD-001', wave_index: 0 }),
        makeBead({ id: 'BEAD-002', wave_index: 1, domain: 'strategy' }),
        makeBead({ id: 'BEAD-003', wave_index: 1, domain: 'product' }),
        makeBead({ id: 'BEAD-004', wave_index: 1, domain: 'operations' }),
        makeBead({ id: 'BEAD-005', wave_index: 1, domain: 'commerce' }),
      ],
    }]
    mockState.missions['plan-1'] = [
      { id: 'm1', status: 'completed', wave_index: 0 },
    ]

    await GET()

    const missionInserts = mockState.insertCalls.filter(c => c.table === 'missions')
    const assignedTos = missionInserts.map(c => (c.data as Record<string, unknown>).assigned_to)

    expect(assignedTos).toContain('light')   // strategy
    expect(assignedTos).toContain('bulma')   // product
    expect(assignedTos).toContain('major')   // operations
    expect(assignedTos).toContain('nanami')  // commerce
  })

  // -------------------------------------------------------------------------
  // 7. Model mapping in tasks
  // -------------------------------------------------------------------------
  it('maps bead model to full model name in task insert', async () => {
    mockState.plans = [{
      id: 'plan-1', title: 'Test Plan', wave_count: 2, status: 'running',
      parsed_beads: [
        makeBead({ id: 'BEAD-001', wave_index: 0 }),
        makeBead({ id: 'BEAD-002', wave_index: 1, model: 'opus' }),
        makeBead({ id: 'BEAD-003', wave_index: 1, model: 'haiku' }),
        makeBead({ id: 'BEAD-004', wave_index: 1, model: 'sonnet' }),
      ],
    }]
    mockState.missions['plan-1'] = [
      { id: 'm1', status: 'completed', wave_index: 0 },
    ]

    await GET()

    const taskInserts = mockState.insertCalls.filter(c => c.table === 'tasks')
    const models = taskInserts.map(c => (c.data as Record<string, unknown>).model)

    expect(models).toContain('claude-opus-4-6')
    expect(models).toContain('claude-haiku-4-5-20251001')
    expect(models).toContain('claude-sonnet-4-6')
  })

  // -------------------------------------------------------------------------
  // 8. Size-to-timeout mapping
  // -------------------------------------------------------------------------
  it('maps bead size to timeout_minutes', async () => {
    mockState.plans = [{
      id: 'plan-1', title: 'Test Plan', wave_count: 2, status: 'running',
      parsed_beads: [
        makeBead({ id: 'BEAD-001', wave_index: 0 }),
        makeBead({ id: 'BEAD-002', wave_index: 1, size: 'S' }),
        makeBead({ id: 'BEAD-003', wave_index: 1, size: 'M' }),
        makeBead({ id: 'BEAD-004', wave_index: 1, size: 'L' }),
      ],
    }]
    mockState.missions['plan-1'] = [
      { id: 'm1', status: 'completed', wave_index: 0 },
    ]

    await GET()

    const taskInserts = mockState.insertCalls.filter(c => c.table === 'tasks')
    const timeouts = taskInserts.map(c => (c.data as Record<string, unknown>).timeout_minutes)

    expect(timeouts).toContain(15) // S
    expect(timeouts).toContain(30) // M
    expect(timeouts).toContain(60) // L
  })

  // -------------------------------------------------------------------------
  // 9. Deployed missions count as terminal
  // -------------------------------------------------------------------------
  it('treats deployed missions as terminal (same as completed)', async () => {
    mockState.plans = [{
      id: 'plan-1', title: 'Test Plan', wave_count: 2, status: 'running',
      parsed_beads: [
        makeBead({ id: 'BEAD-001', wave_index: 0 }),
        makeBead({ id: 'BEAD-002', wave_index: 1 }),
      ],
    }]
    mockState.missions['plan-1'] = [
      { id: 'm1', status: 'deployed', wave_index: 0 },
    ]

    const res = await GET()
    const json = await res.json()

    // Should have advanced since deployed is terminal
    expect(json.advanced).toBe(1)
  })

  // -------------------------------------------------------------------------
  // 10. Multiple plans processed independently
  // -------------------------------------------------------------------------
  it('processes multiple running plans independently', async () => {
    mockState.plans = [
      {
        id: 'plan-1', title: 'Plan A', wave_count: 1, status: 'running',
        parsed_beads: [makeBead({ id: 'BEAD-001', wave_index: 0 })],
      },
      {
        id: 'plan-2', title: 'Plan B', wave_count: 2, status: 'running',
        parsed_beads: [
          makeBead({ id: 'BEAD-001', wave_index: 0 }),
          makeBead({ id: 'BEAD-002', wave_index: 1 }),
        ],
      },
    ]
    mockState.missions['plan-1'] = [
      { id: 'm1', status: 'completed', wave_index: 0 },
    ]
    mockState.missions['plan-2'] = [
      { id: 'm2', status: 'completed', wave_index: 0 },
    ]

    const res = await GET()
    const json = await res.json()

    // plan-1 should complete (no wave 1 beads), plan-2 should advance
    expect(json.completed).toBe(1)
    expect(json.advanced).toBe(1)
    expect(json.plansChecked).toBe(2)
  })

  // -------------------------------------------------------------------------
  // 11. Task description includes acceptance criteria and files
  // -------------------------------------------------------------------------
  it('builds task description from bead fields', async () => {
    mockState.plans = [{
      id: 'plan-1', title: 'Test Plan', wave_count: 2, status: 'running',
      parsed_beads: [
        makeBead({ id: 'BEAD-001', wave_index: 0 }),
        makeBead({
          id: 'BEAD-002', wave_index: 1,
          description: 'Build the widget',
          accept: ['Widget renders', 'Tests pass'],
          files: ['lib/widget.ts', 'tests/widget.test.ts'],
        }),
      ],
    }]
    mockState.missions['plan-1'] = [
      { id: 'm1', status: 'completed', wave_index: 0 },
    ]

    await GET()

    const taskInserts = mockState.insertCalls.filter(c => c.table === 'tasks')
    expect(taskInserts.length).toBeGreaterThanOrEqual(1)
    const desc = (taskInserts[0].data as Record<string, unknown>).description as string
    expect(desc).toContain('Build the widget')
    expect(desc).toContain('Widget renders')
    expect(desc).toContain('Tests pass')
    expect(desc).toContain('lib/widget.ts')
  })

  // -------------------------------------------------------------------------
  // 12. Working directory from repo field
  // -------------------------------------------------------------------------
  it('sets working_dir from bead repo field', async () => {
    mockState.plans = [{
      id: 'plan-1', title: 'Test Plan', wave_count: 2, status: 'running',
      parsed_beads: [
        makeBead({ id: 'BEAD-001', wave_index: 0 }),
        makeBead({ id: 'BEAD-002', wave_index: 1, repo: 'shogunate' }),
      ],
    }]
    mockState.missions['plan-1'] = [
      { id: 'm1', status: 'completed', wave_index: 0 },
    ]

    await GET()

    const taskInserts = mockState.insertCalls.filter(c => c.table === 'tasks')
    const workingDir = (taskInserts[0].data as Record<string, unknown>).working_dir
    expect(workingDir).toBe('~/Code/shogunate')
  })
})
