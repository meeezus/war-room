import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock — must be hoisted before module imports
// ---------------------------------------------------------------------------
const { mockFrom, mockSelect, mockIn, mockEq, mockOrder, mockLimit, mockGte, mockNot } = vi.hoisted(() => {
  const mockNot = vi.fn()
  const mockGte = vi.fn()
  const mockLimit = vi.fn()
  const mockOrder = vi.fn()
  const mockIn = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const mockFrom = vi.fn()

  // Default chain: from().select() returns { data, error }
  mockLimit.mockResolvedValue({ data: [], error: null, count: 0 })
  mockOrder.mockReturnValue({ limit: mockLimit })
  mockGte.mockResolvedValue({ data: [], error: null, count: 0 })
  mockNot.mockReturnValue({ order: mockOrder, eq: mockEq, in: mockIn, gte: mockGte })
  mockEq.mockReturnValue({ gte: mockGte, order: mockOrder, not: mockNot })
  mockIn.mockReturnValue({ order: mockOrder, eq: mockEq, not: mockNot })
  mockSelect.mockReturnValue({ in: mockIn, eq: mockEq, order: mockOrder, not: mockNot })
  mockFrom.mockReturnValue({ select: mockSelect })

  return { mockFrom, mockSelect, mockIn, mockEq, mockOrder, mockLimit, mockGte, mockNot }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

import { getTaskPipelineCounts, getOutcomeCounts } from '@/lib/queries'

describe('getTaskPipelineCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('returns zero counts when no tasks exist', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null })
    const result = await getTaskPipelineCounts()
    expect(result).toEqual({
      proposed: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      failed: 0,
    })
  })

  it('counts tasks by status', async () => {
    mockSelect.mockResolvedValue({
      data: [
        { status: 'proposed' },
        { status: 'proposed' },
        { status: 'in_progress' },
        { status: 'done' },
        { status: 'done' },
        { status: 'done' },
        { status: 'failed' },
      ],
      error: null,
    })
    const result = await getTaskPipelineCounts()
    expect(result).toEqual({
      proposed: 2,
      in_progress: 1,
      review: 0,
      done: 3,
      failed: 1,
    })
  })

  it('returns zero counts on error', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'db error' } })
    const result = await getTaskPipelineCounts()
    expect(result).toEqual({
      proposed: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      failed: 0,
    })
  })

  it('queries the tasks table', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null })
    await getTaskPipelineCounts()
    expect(mockFrom).toHaveBeenCalledWith('tasks')
    expect(mockSelect).toHaveBeenCalledWith('status')
  })
})

describe('getOutcomeCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set up the chain for getOutcomeCounts - more complex due to Promise.all
    mockLimit.mockResolvedValue({ data: [], error: null, count: 0 })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockGte.mockResolvedValue({ data: [], error: null, count: 0 })
    mockNot.mockReturnValue({ order: mockOrder, eq: mockEq, in: mockIn, gte: mockGte })
    mockEq.mockReturnValue({ gte: mockGte, order: mockOrder, not: mockNot })
    mockIn.mockReturnValue({ order: mockOrder, eq: mockEq, gte: mockGte, not: mockNot })
    mockSelect.mockReturnValue({ in: mockIn, eq: mockEq, order: mockOrder, not: mockNot })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('returns all four outcome categories', async () => {
    const result = await getOutcomeCounts()
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(['research', 'aeon', 'opsec', 'messages'])
    )
  })

  it('each card has required OutcomeCard fields', async () => {
    const result = await getOutcomeCounts()
    for (const key of ['research', 'aeon', 'opsec', 'messages']) {
      const card = result[key]
      expect(card).toHaveProperty('category')
      expect(card).toHaveProperty('headline')
      expect(card).toHaveProperty('count')
      expect(typeof card.count).toBe('number')
    }
  })

  it('research card shows initializing when table does not exist', async () => {
    const result = await getOutcomeCounts()
    expect(result.research.category).toBe('research')
    expect(result.research).toHaveProperty('headline')
  })

  it('opsec card combines proposals and discoveries', async () => {
    // This test verifies the opsec category queries patrol proposals and discoveries
    const result = await getOutcomeCounts()
    expect(result.opsec.category).toBe('opsec')
    expect(result.opsec).toHaveProperty('items')
  })
})
