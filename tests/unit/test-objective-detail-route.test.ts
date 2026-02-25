import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock createServiceClient before importing the route
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { GET, PATCH, DELETE } from '@/app/api/objectives/[id]/route'
import { createServiceClient } from '@/lib/supabase-server'

const FAKE_ID = '11111111-1111-1111-1111-111111111111'

function makeGetRequest(): Request {
  return new Request(`http://localhost:3000/api/objectives/${FAKE_ID}`, {
    method: 'GET',
  })
}

function makePatchRequest(body: Record<string, unknown>): Request {
  return new Request(`http://localhost:3000/api/objectives/${FAKE_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(): Request {
  return new Request(`http://localhost:3000/api/objectives/${FAKE_ID}`, {
    method: 'DELETE',
  })
}

const fakeParams = Promise.resolve({ id: FAKE_ID })

describe('GET /api/objectives/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 500 when createServiceClient returns null', async () => {
    vi.mocked(createServiceClient).mockReturnValueOnce(null)
    const res = await GET(makeGetRequest(), { params: fakeParams })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBeTruthy()
  })

  it('returns 404 when objective is not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    })

    const res = await GET(makeGetRequest(), { params: fakeParams })
    expect(res.status).toBe(404)
  })

  it('returns objective data on success', async () => {
    const fakeObjective = {
      id: FAKE_ID,
      title: 'Test Objective',
      status: 'active',
      description: 'A test objective',
      success_criteria: 'Tests pass',
    }

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: fakeObjective, error: null }),
        }),
      }),
    })

    const res = await GET(makeGetRequest(), { params: fakeParams })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.objective).toEqual(fakeObjective)
  })
})

describe('PATCH /api/objectives/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 500 when createServiceClient returns null', async () => {
    vi.mocked(createServiceClient).mockReturnValueOnce(null)
    const res = await PATCH(makePatchRequest({ status: 'paused' }), { params: fakeParams })
    expect(res.status).toBe(500)
  })

  it('returns 400 when no valid fields are provided', async () => {
    const res = await PATCH(makePatchRequest({ bogus_field: 'nope' }), { params: fakeParams })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/no valid fields/i)
  })

  it('updates allowed fields only', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const res = await PATCH(
      makePatchRequest({ status: 'paused', title: 'Updated Title', bogus: 'ignored' }),
      { params: fakeParams }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    // Verify only allowed fields were passed to update
    const updateCall = mockFrom.mock.results[0].value.update
    expect(updateCall).toHaveBeenCalledWith({
      status: 'paused',
      title: 'Updated Title',
    })
  })

  it('returns 500 on supabase error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      }),
    })

    const res = await PATCH(makePatchRequest({ status: 'completed' }), { params: fakeParams })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/objectives/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 500 when createServiceClient returns null', async () => {
    vi.mocked(createServiceClient).mockReturnValueOnce(null)
    const res = await DELETE(makeDeleteRequest(), { params: fakeParams })
    expect(res.status).toBe(500)
  })

  it('deletes objective successfully', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const res = await DELETE(makeDeleteRequest(), { params: fakeParams })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('returns 500 on supabase error', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'FK constraint' } }),
      }),
    })

    const res = await DELETE(makeDeleteRequest(), { params: fakeParams })
    expect(res.status).toBe(500)
  })
})
