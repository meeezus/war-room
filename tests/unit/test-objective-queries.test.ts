import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase client
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import { getObjectiveWithRelated } from '@/lib/queries'

const FAKE_ID = 'aaaa-bbbb-cccc-dddd'

const fakeObjective = {
  id: FAKE_ID,
  title: 'Test Objective',
  description: 'A test',
  success_criteria: 'All tests pass',
  status: 'active',
  iteration_count: 2,
  max_iterations: 5,
  created_by: 'sensei',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  completed_at: null,
  project_id: null,
  max_cost_usd: null,
}

const fakeProjects = [
  { id: 'p1', title: 'Project 1', status: 'inprogress', priority: 1, goal: null, type: null, owner: null, notes: null, next_action: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'p2', title: 'Project 2', status: 'done', priority: 2, goal: null, type: null, owner: null, notes: null, next_action: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
]

const fakeMissions = [
  { id: 'm1', title: 'Mission 1', status: 'queued', assigned_to: 'ed', created_at: '2026-01-01' },
]

const fakeProposals = [
  { id: 'pr1', title: 'Proposal 1', status: 'pending', source: 'manual', created_at: '2026-01-01' },
]

describe('getObjectiveWithRelated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null objective when supabase is null', async () => {
    // Temporarily override supabase to null
    const supabaseMod = await import('@/lib/supabase')
    const original = supabaseMod.supabase
    Object.defineProperty(supabaseMod, 'supabase', { value: null, writable: true })

    const result = await getObjectiveWithRelated(FAKE_ID)
    expect(result.objective).toBeNull()
    expect(result.projects).toEqual([])
    expect(result.missions).toEqual([])
    expect(result.proposals).toEqual([])

    // Restore
    Object.defineProperty(supabaseMod, 'supabase', { value: original, writable: true })
  })

  it('fetches objective and all related entities', async () => {
    // Build chain mocks for 4 parallel queries
    let callIndex = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'objectives') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: fakeObjective, error: null }),
            }),
          }),
        }
      }
      if (table === 'projects') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: fakeProjects, error: null }),
            }),
          }),
        }
      }
      if (table === 'missions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: fakeMissions, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'proposals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: fakeProposals, error: null }),
              }),
            }),
          }),
        }
      }
      return {}
    })

    const result = await getObjectiveWithRelated(FAKE_ID)

    expect(result.objective).toEqual(fakeObjective)
    expect(result.projects).toEqual(fakeProjects)
    expect(result.missions).toEqual(fakeMissions)
    expect(result.proposals).toEqual(fakeProposals)

    // Verify correct tables were queried
    expect(mockFrom).toHaveBeenCalledWith('objectives')
    expect(mockFrom).toHaveBeenCalledWith('projects')
    expect(mockFrom).toHaveBeenCalledWith('missions')
    expect(mockFrom).toHaveBeenCalledWith('proposals')
  })

  it('returns empty arrays when related queries fail', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'objectives') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: fakeObjective, error: null }),
            }),
          }),
        }
      }
      // All related queries fail
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      }
    })

    const result = await getObjectiveWithRelated(FAKE_ID)

    expect(result.objective).toEqual(fakeObjective)
    expect(result.projects).toEqual([])
    expect(result.missions).toEqual([])
    expect(result.proposals).toEqual([])
  })

  it('returns null objective when objective not found', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'objectives') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }
    })

    const result = await getObjectiveWithRelated(FAKE_ID)
    expect(result.objective).toBeNull()
  })
})
