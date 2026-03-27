import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Research Findings Query Tests
// ---------------------------------------------------------------------------
// Tests for getResearchFindings and getResearchFindingsCount in lib/queries.ts

const mockSelect = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import { getResearchFindings, getResearchFindingsCount } from '@/lib/queries'

describe('getResearchFindings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default chain: from -> select -> order -> limit
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockLimit.mockResolvedValue({ data: [], error: null })
  })

  it('returns an array of research findings', async () => {
    const mockFindings = [
      { id: '1', source: 'twitter', title: 'Test finding', status: 'new', created_at: '2026-03-25T00:00:00Z' },
    ]
    mockLimit.mockResolvedValueOnce({ data: mockFindings, error: null })

    const result = await getResearchFindings()
    expect(result).toEqual(mockFindings)
    expect(mockFrom).toHaveBeenCalledWith('research_findings')
  })

  it('applies default limit of 20', async () => {
    await getResearchFindings()
    expect(mockLimit).toHaveBeenCalledWith(20)
  })

  it('applies custom limit', async () => {
    await getResearchFindings(50)
    expect(mockLimit).toHaveBeenCalledWith(50)
  })

  it('filters by status when provided', async () => {
    mockOrder.mockReturnValue({ limit: mockLimit, eq: mockEq })
    mockEq.mockReturnValue({ limit: mockLimit })

    // When status is provided, eq should be called before limit
    // The chain is: from -> select -> order -> eq(status) -> limit
    await getResearchFindings(20, 'new')
    expect(mockEq).toHaveBeenCalledWith('status', 'new')
  })

  it('returns empty array on error', async () => {
    mockLimit.mockResolvedValueOnce({ data: null, error: { message: 'table not found' } })
    const result = await getResearchFindings()
    expect(result).toEqual([])
  })

  it('orders by created_at descending', async () => {
    await getResearchFindings()
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})

describe('getResearchFindingsCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns total, new, and actionable counts', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
    }))
    // First call: total (no eq filter)
    const selectResults = [
      { count: 10, error: null },  // total
      { count: 5, error: null },   // new (eq status=new)
      { count: 3, error: null },   // actionable (eq status=actionable)
    ]
    let callIdx = 0
    mockSelect.mockImplementation(() => {
      const result = selectResults[callIdx++]
      return {
        ...result,
        eq: vi.fn().mockResolvedValue(result),
      }
    })

    const result = await getResearchFindingsCount()
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('new')
    expect(result).toHaveProperty('actionable')
    expect(typeof result.total).toBe('number')
    expect(typeof result.new).toBe('number')
    expect(typeof result.actionable).toBe('number')
  })

  it('returns zeros when supabase errors', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'err' } }),
      }),
    })

    const result = await getResearchFindingsCount()
    expect(result.total).toBe(0)
    expect(result.new).toBe(0)
    expect(result.actionable).toBe(0)
  })
})
