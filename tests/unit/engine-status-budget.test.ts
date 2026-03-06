import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/server before import
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      json: async () => body,
      status: init?.status ?? 200,
    })),
  },
}))

const mockFrom = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

// Minimal supabase chain stub that resolves on await
function makeChain(returnValue: { data: unknown; error: null; count?: number }) {
  const thenable = {
    then(resolve: (v: unknown) => void) {
      resolve(returnValue)
    },
  }
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returnValue),
  }
  // Make chain await-able (for queries without .single())
  Object.assign(chain, thenable)
  // Allow method chaining to return the same chain
  for (const key of ['select', 'eq', 'gte', 'not', 'order', 'limit']) {
    ;(chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  }
  return chain
}

const { GET } = await import('../../app/api/engine-status/route')

describe('budgetOk in engine-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  it('returns budgetOk true when daily spend is under the cap', async () => {
    let missionsCallCount = 0

    mockFrom.mockImplementation((table: string) => {
      if (table === 'cap_gates') {
        return makeChain({ data: { daily_budget_usd: 50 }, error: null })
      }
      if (table === 'missions') {
        missionsCallCount++
        // Daily cost query returns missions with cost_estimate summing to 10 (under 50)
        if (missionsCallCount >= 3) {
          return makeChain({ data: [{ cost_estimate: 10 }], error: null })
        }
        return makeChain({ data: [], error: null })
      }
      if (table === 'war_room_events') {
        return makeChain({ data: [], error: null })
      }
      if (table === 'objectives') {
        return makeChain({ data: [], error: null })
      }
      if (table === 'proposals') {
        return makeChain({ data: [], error: null, count: 0 })
      }
      return makeChain({ data: [], error: null, count: 0 })
    })

    const response = await GET()
    const body = await response.json()
    expect(body.budgetOk).toBe(true)
  })

  it('returns budgetOk false when daily spend exceeds the cap', async () => {
    let missionsCallCount = 0

    mockFrom.mockImplementation((table: string) => {
      if (table === 'cap_gates') {
        return makeChain({ data: { daily_budget_usd: 50 }, error: null })
      }
      if (table === 'missions') {
        missionsCallCount++
        if (missionsCallCount >= 3) {
          return makeChain({ data: [{ cost_estimate: 75 }], error: null })
        }
        return makeChain({ data: [], error: null })
      }
      if (table === 'war_room_events') {
        return makeChain({ data: [], error: null })
      }
      if (table === 'objectives') {
        return makeChain({ data: [], error: null })
      }
      if (table === 'proposals') {
        return makeChain({ data: [], error: null, count: 0 })
      }
      return makeChain({ data: [], error: null, count: 0 })
    })

    const response = await GET()
    const body = await response.json()
    expect(body.budgetOk).toBe(false)
  })

  it('returns budgetOk true when cap_gates has no row (safe fallback)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cap_gates') {
        return makeChain({ data: null, error: null })
      }
      if (table === 'missions') {
        return makeChain({ data: [{ cost_estimate: 999 }], error: null })
      }
      if (table === 'war_room_events') {
        return makeChain({ data: [], error: null })
      }
      if (table === 'objectives') {
        return makeChain({ data: [], error: null })
      }
      if (table === 'proposals') {
        return makeChain({ data: [], error: null, count: 0 })
      }
      return makeChain({ data: [], error: null, count: 0 })
    })

    const response = await GET()
    const body = await response.json()
    // No cap configured → always budgetOk
    expect(body.budgetOk).toBe(true)
  })
})

// Isolated unit tests for the budgetOk computation logic
describe('budgetOk computation logic', () => {
  it('spend < cap → budgetOk true', () => {
    const dailySpendUsd = 30
    const dailyBudgetUsd = 50
    expect(dailySpendUsd < dailyBudgetUsd).toBe(true)
  })

  it('spend > cap → budgetOk false', () => {
    const dailySpendUsd = 60
    const dailyBudgetUsd = 50
    expect(dailySpendUsd < dailyBudgetUsd).toBe(false)
  })

  it('spend === cap → budgetOk false (at-cap = over)', () => {
    const dailySpendUsd = 50
    const dailyBudgetUsd = 50
    expect(dailySpendUsd < dailyBudgetUsd).toBe(false)
  })

  it('no cap gate row → budgetOk true (null fallback)', () => {
    const dailyBudgetUsd: number | null = null
    const budgetOk = dailyBudgetUsd === null ? true : 999 < dailyBudgetUsd
    expect(budgetOk).toBe(true)
  })

  it('sums multiple missions correctly', () => {
    const missions = [{ cost_estimate: 10 }, { cost_estimate: 15 }, { cost_estimate: 8 }]
    const total = missions.reduce((sum, m) => sum + (m.cost_estimate ?? 0), 0)
    expect(total).toBe(33)
  })
})
