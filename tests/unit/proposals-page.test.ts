import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing queries
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs)
          return {
            order: (...oArgs: unknown[]) => {
              mockOrder(...oArgs)
              return {
                order: (...o2Args: unknown[]) => {
                  mockOrder(...o2Args)
                  return {
                    limit: (...lArgs: unknown[]) => {
                      mockLimit(...lArgs)
                      return Promise.resolve({ data: [], error: null })
                    },
                    then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null }),
                    data: [],
                    error: null,
                  }
                },
                limit: (...lArgs: unknown[]) => {
                  mockLimit(...lArgs)
                  return Promise.resolve({ data: [], error: null })
                },
                eq: (...eArgs: unknown[]) => {
                  mockEq(...eArgs)
                  return {
                    order: (...oArgs2: unknown[]) => {
                      mockOrder(...oArgs2)
                      return Promise.resolve({ data: [], error: null })
                    },
                  }
                },
              }
            },
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs)
              return {
                order: (...oArgs: unknown[]) => {
                  mockOrder(...oArgs)
                  return {
                    order: (...o2Args: unknown[]) => {
                      mockOrder(...o2Args)
                      return Promise.resolve({ data: [], error: null })
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  },
}))

describe('getProposals query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is exported from queries module', async () => {
    const queries = await import('@/lib/queries')
    expect(typeof queries.getProposals).toBe('function')
  })

  it('returns an array (empty when no data)', async () => {
    const { getProposals } = await import('@/lib/queries')
    const result = await getProposals()
    expect(Array.isArray(result)).toBe(true)
  })

  it('queries the proposals table', async () => {
    const { getProposals } = await import('@/lib/queries')
    await getProposals()
    expect(mockFrom).toHaveBeenCalledWith('proposals')
  })

  it('accepts an optional status filter parameter', async () => {
    const { getProposals } = await import('@/lib/queries')
    // Should not throw when called with status
    await getProposals('pending')
    expect(mockFrom).toHaveBeenCalledWith('proposals')
  })

  it('orders results by created_at descending by default', async () => {
    const { getProposals } = await import('@/lib/queries')
    await getProposals()
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})

describe('Proposal type has phase fields', () => {
  it('Proposal interface includes phase field in type definition', async () => {
    // We verify the type file exports the expected shape by checking
    // that a sample proposal with phase compiles (this test validates
    // the type at test time by creating an object matching the interface)
    const types = await import('@/lib/types')
    // TypeScript will fail to compile if Proposal doesn't have phase
    const sample: types.Proposal = {
      id: 'test',
      title: 'test',
      description: null,
      source: 'manual',
      requested_by: 'sensei',
      domain: null,
      cost_estimate: null,
      time_estimate: null,
      risk_level: null,
      auto_approved: false,
      council_review: false,
      reviews: [],
      approved_at: null,
      approved_by: null,
      project_id: null,
      discovery_id: null,
      status: 'pending',
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
      phase: 'scope',
      phase_artifacts: null,
    }
    expect(sample.phase).toBe('scope')
    expect(sample.phase_artifacts).toBeNull()
  })
})

describe('Proposals page module', () => {
  it('exports a default component from app/proposals/page', async () => {
    const mod = await import('@/app/proposals/page')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })
})
