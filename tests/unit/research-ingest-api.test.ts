import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Research Ingest API Route Tests
// ---------------------------------------------------------------------------

const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: (...args: unknown[]) => {
        mockInsert(...args)
        return { select: mockSelect }
      },
    }),
  }),
}))

mockSelect.mockReturnValue({ single: mockSingle })

import { POST } from '@/app/api/research/ingest/route'

describe('POST /api/research/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockReturnValue({ single: mockSingle })
  })

  it('creates a finding and returns 201', async () => {
    const mockFinding = {
      id: 'abc-123',
      source: 'twitter',
      title: 'New AI paper',
      summary: 'Summary of the paper',
      status: 'new',
    }
    mockSingle.mockResolvedValueOnce({ data: mockFinding, error: null })

    const request = new Request('http://localhost:3000/api/research/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'twitter', title: 'New AI paper', summary: 'Summary of the paper' }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json).toHaveProperty('finding')
    expect(json.finding.source).toBe('twitter')
  })

  it('returns 400 when source is missing', async () => {
    const request = new Request('http://localhost:3000/api/research/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No source' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toMatch(/source.*title.*required/i)
  })

  it('returns 400 when title is missing', async () => {
    const request = new Request('http://localhost:3000/api/research/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'twitter' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toMatch(/source.*title.*required/i)
  })

  it('returns 500 on Supabase error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } })

    const request = new Request('http://localhost:3000/api/research/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'arxiv', title: 'Test paper' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })

  it('returns 400 on invalid JSON', async () => {
    const request = new Request('http://localhost:3000/api/research/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('sets default values for optional fields', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: '1' }, error: null })

    const request = new Request('http://localhost:3000/api/research/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'manual', title: 'Manual entry' }),
    })

    await POST(request)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'manual',
        title: 'Manual entry',
        summary: null,
        url: null,
        relevance: 'medium',
        tags: [],
        metadata: {},
      })
    )
  })
})
