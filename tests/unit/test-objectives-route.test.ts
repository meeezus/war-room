import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock createServiceClient before importing the route
const mockSelect = vi.fn()
const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { POST } from '@/app/api/objectives/route'
import { createServiceClient } from '@/lib/supabase-server'

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/objectives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/objectives', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Validation tests ---

  it('returns 400 when title is missing', async () => {
    const res = await POST(makeRequest({
      description: 'some desc',
      success_criteria: 'some criteria',
    }) as any)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/title.*required/i)
  })

  it('returns 400 when description is missing', async () => {
    const res = await POST(makeRequest({
      title: 'Test Objective',
      success_criteria: 'some criteria',
    }) as any)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/description.*required/i)
  })

  it('returns 400 when success_criteria is missing', async () => {
    const res = await POST(makeRequest({
      title: 'Test Objective',
      description: 'some desc',
    }) as any)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/success_criteria.*required/i)
  })

  it('returns 500 when createServiceClient returns null', async () => {
    vi.mocked(createServiceClient).mockReturnValueOnce(null)

    const res = await POST(makeRequest({
      title: 'Test Objective',
      description: 'some desc',
      success_criteria: 'works correctly',
    }) as any)

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBeTruthy()
  })

  // --- Happy path ---

  it('creates objective and initial proposal on valid input', async () => {
    const fakeObjective = {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Test Objective',
      description: 'some desc',
      success_criteria: 'works correctly',
      project_id: null,
      max_iterations: 5,
      status: 'active',
      created_by: 'sensei',
    }
    const fakeProposal = {
      id: '22222222-2222-2222-2222-222222222222',
      title: '[Objective] Test Objective',
      description: 'some desc',
      source: 'shoin_chat',
      requested_by: 'sensei',
      objective_id: fakeObjective.id,
      status: 'pending',
    }

    // First call: objectives insert
    // Second call: proposals insert
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      callCount++
      if (table === 'objectives') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: fakeObjective, error: null }),
            }),
          }),
        }
      }
      if (table === 'proposals') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: fakeProposal, error: null }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await POST(makeRequest({
      title: 'Test Objective',
      description: 'some desc',
      success_criteria: 'works correctly',
    }) as any)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.objective).toEqual(fakeObjective)
    expect(json.proposal).toEqual(fakeProposal)
  })

  it('passes project_id and max_iterations when provided', async () => {
    const fakeObjective = {
      id: '33333333-3333-3333-3333-333333333333',
      title: 'With Project',
      description: 'desc',
      success_criteria: 'criteria',
      project_id: 'proj-123',
      max_iterations: 10,
      status: 'active',
      created_by: 'sensei',
    }
    const fakeProposal = {
      id: '44444444-4444-4444-4444-444444444444',
      title: '[Objective] With Project',
      objective_id: fakeObjective.id,
    }

    let capturedObjInsert: Record<string, unknown> | null = null
    let capturedPropInsert: Record<string, unknown> | null = null

    mockFrom.mockImplementation((table: string) => {
      if (table === 'objectives') {
        return {
          insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            capturedObjInsert = data
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: fakeObjective, error: null }),
              }),
            }
          }),
        }
      }
      if (table === 'proposals') {
        return {
          insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            capturedPropInsert = data
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: fakeProposal, error: null }),
              }),
            }
          }),
        }
      }
      return {}
    })

    const res = await POST(makeRequest({
      title: 'With Project',
      description: 'desc',
      success_criteria: 'criteria',
      project_id: 'proj-123',
      max_iterations: 10,
    }) as any)

    expect(res.status).toBe(200)
    expect(capturedObjInsert).toBeTruthy()
    expect(capturedObjInsert!.project_id).toBe('proj-123')
    expect(capturedObjInsert!.max_iterations).toBe(10)
    expect(capturedPropInsert).toBeTruthy()
    expect(capturedPropInsert!.project_id).toBe('proj-123')
    expect(capturedPropInsert!.objective_id).toBe(fakeObjective.id)
  })

  it('returns 500 when objective insert fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'objectives') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'DB error', code: '42P01' },
              }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await POST(makeRequest({
      title: 'Fail Objective',
      description: 'desc',
      success_criteria: 'criteria',
    }) as any)

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/failed/i)
  })

  it('returns 500 when proposal insert fails', async () => {
    const fakeObjective = {
      id: '55555555-5555-5555-5555-555555555555',
      title: 'Good Objective',
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'objectives') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: fakeObjective, error: null }),
            }),
          }),
        }
      }
      if (table === 'proposals') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Proposal insert failed' },
              }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await POST(makeRequest({
      title: 'Good Objective',
      description: 'desc',
      success_criteria: 'criteria',
    }) as any)

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/failed/i)
  })
})
