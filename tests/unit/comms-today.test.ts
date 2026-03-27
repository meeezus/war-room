import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock — hoisted before module imports
// ---------------------------------------------------------------------------
const { mockFrom, mockSelect, mockIn, mockEq, mockOrder, mockLimit, mockGte } = vi.hoisted(() => {
  const mockGte = vi.fn()
  const mockLimit = vi.fn()
  const mockOrder = vi.fn()
  const mockIn = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const mockFrom = vi.fn()

  // Default chain: from().select().in().gte().order().limit() -> { data, error }
  mockLimit.mockResolvedValue({ data: [], error: null, count: 0 })
  mockOrder.mockReturnValue({ limit: mockLimit })
  mockGte.mockReturnValue({ order: mockOrder })
  mockIn.mockReturnValue({ order: mockOrder, gte: mockGte })
  mockSelect.mockReturnValue({ in: mockIn, eq: mockEq, order: mockOrder })
  mockFrom.mockReturnValue({ select: mockSelect })

  return { mockFrom, mockSelect, mockIn, mockEq, mockOrder, mockLimit, mockGte }
})

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: () => ({
    from: mockFrom,
  }),
}))

// ---------------------------------------------------------------------------
// Tests for /api/comms/today route handler
// ---------------------------------------------------------------------------
describe('GET /api/comms/today', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLimit.mockResolvedValue({ data: [], error: null, count: 0 })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockGte.mockReturnValue({ order: mockOrder })
    mockIn.mockReturnValue({ order: mockOrder, gte: mockGte })
    mockSelect.mockReturnValue({ in: mockIn, eq: mockEq, order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('returns JSON with items array, unreadCount, and totalToday', async () => {
    const { GET } = await import('@/app/api/comms/today/route')
    const res = await GET()
    const body = await res.json()

    expect(body).toHaveProperty('items')
    expect(body).toHaveProperty('unreadCount')
    expect(body).toHaveProperty('totalToday')
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('returns placeholder item when no events exist', async () => {
    const { GET } = await import('@/app/api/comms/today/route')
    const res = await GET()
    const body = await res.json()

    expect(body.items.length).toBeGreaterThanOrEqual(1)
    expect(body.items[0].source).toBe('notification')
    expect(body.items[0].title).toMatch(/messages feed active/i)
  })

  it('returns real events when they exist', async () => {
    const now = new Date().toISOString()
    mockLimit.mockResolvedValue({
      data: [
        { title: 'Ops Hub deployed', event_type: 'notification', created_at: now, description: 'v2 live' },
        { title: 'Morning brief', event_type: 'brief', created_at: now, description: 'Daily summary' },
      ],
      error: null,
    })

    const { GET } = await import('@/app/api/comms/today/route')
    const res = await GET()
    const body = await res.json()

    expect(body.items).toHaveLength(2)
    expect(body.items[0].title).toBe('Ops Hub deployed')
    expect(body.items[0].source).toBe('notification')
    expect(body.items[1].title).toBe('Morning brief')
    expect(body.items[1].source).toBe('brief')
    expect(body.totalToday).toBe(2)
  })

  it('maps brief event_type to "brief" source', async () => {
    mockLimit.mockResolvedValue({
      data: [
        { title: 'Morning brief', event_type: 'brief', created_at: new Date().toISOString(), description: null },
      ],
      error: null,
    })

    const { GET } = await import('@/app/api/comms/today/route')
    const res = await GET()
    const body = await res.json()

    expect(body.items[0].source).toBe('brief')
  })

  it('maps non-brief event_type to "notification" source', async () => {
    mockLimit.mockResolvedValue({
      data: [
        { title: 'Plan completed', event_type: 'plan_completed', created_at: new Date().toISOString(), description: null },
      ],
      error: null,
    })

    const { GET } = await import('@/app/api/comms/today/route')
    const res = await GET()
    const body = await res.json()

    expect(body.items[0].source).toBe('notification')
  })

  it('queries war_room_events with expanded event_type filter', async () => {
    const { GET } = await import('@/app/api/comms/today/route')
    await GET()

    expect(mockFrom).toHaveBeenCalledWith('war_room_events')
    expect(mockIn).toHaveBeenCalledWith('event_type', expect.arrayContaining([
      'brief', 'notification', 'message',
      'plan_completed', 'plan_failed', 'plan_approved',
      'toji_scan_complete', 'research_scan_complete', 'patrol_complete',
    ]))
  })

  it('filters to today only via gte', async () => {
    const { GET } = await import('@/app/api/comms/today/route')
    await GET()

    // gte should be called with 'created_at' and today's local-midnight in UTC ISO format
    const expectedMidnight = new Date()
    expectedMidnight.setHours(0, 0, 0, 0)
    expect(mockGte).toHaveBeenCalledWith('created_at', expectedMidnight.toISOString())
  })

  it('limits results to 20', async () => {
    const { GET } = await import('@/app/api/comms/today/route')
    await GET()

    expect(mockLimit).toHaveBeenCalledWith(20)
  })
})

// ---------------------------------------------------------------------------
// Tests for expanded getOutcomeCounts messages section
// ---------------------------------------------------------------------------
describe('getOutcomeCounts messages section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLimit.mockResolvedValue({ data: [], error: null, count: 0 })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockGte.mockResolvedValue({ data: [], error: null, count: 0 })
    mockEq.mockReturnValue({ gte: mockGte, order: mockOrder })
    mockIn.mockReturnValue({ order: mockOrder, eq: mockEq, gte: mockGte })
    mockSelect.mockReturnValue({ in: mockIn, eq: mockEq, order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  // Re-mock for queries.ts which uses @/lib/supabase (not supabase-server)
  // The existing queries-pipeline.test.ts covers getOutcomeCounts structure.
  // Here we test the expanded event types and "today" headline behavior.

  it('messages headline says "N today" when events exist', async () => {
    // We need to mock the supabase module for queries.ts
    vi.doMock('@/lib/supabase', () => ({
      supabase: { from: mockFrom },
    }))

    const todayEvents = [
      { id: '1', title: 'Plan completed', created_at: new Date().toISOString(), event_type: 'plan_completed' },
      { id: '2', title: 'Scan done', created_at: new Date().toISOString(), event_type: 'toji_scan_complete' },
      { id: '3', title: 'Alert', created_at: new Date().toISOString(), event_type: 'notification' },
    ]

    // For the messages query in getOutcomeCounts, the chain is:
    // from('war_room_events').select(...).in(...).order(...).limit(3) -> data
    // from('war_room_events').select(...).in(...).gte(...) -> count
    let callCount = 0
    mockLimit.mockImplementation(() => {
      callCount++
      // The messages query has .order().limit() — return events
      return Promise.resolve({ data: todayEvents, error: null, count: 3 })
    })
    mockGte.mockResolvedValue({ data: null, error: null, count: 5 })

    const { getOutcomeCounts } = await import('@/lib/queries')
    const result = await getOutcomeCounts()

    // The headline should say "N today" format instead of "N recent"
    expect(result.messages.headline).toMatch(/today/i)
  })
})
