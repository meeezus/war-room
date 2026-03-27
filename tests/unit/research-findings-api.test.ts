import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Research Findings API Route Tests
// ---------------------------------------------------------------------------

// Mock getResearchFindings
const mockGetResearchFindings = vi.fn()
vi.mock('@/lib/queries', () => ({
  getResearchFindings: (...args: unknown[]) => mockGetResearchFindings(...args),
}))

import { GET } from '@/app/api/research/findings/route'

describe('GET /api/research/findings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns findings as JSON', async () => {
    const mockData = [
      { id: '1', source: 'twitter', title: 'AI breakthrough', status: 'new' },
    ]
    mockGetResearchFindings.mockResolvedValueOnce(mockData)

    const request = new Request('http://localhost:3000/api/research/findings')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveProperty('findings')
    expect(json.findings).toEqual(mockData)
  })

  it('passes limit from search params', async () => {
    mockGetResearchFindings.mockResolvedValueOnce([])

    const request = new Request('http://localhost:3000/api/research/findings?limit=5')
    await GET(request)

    expect(mockGetResearchFindings).toHaveBeenCalledWith(5, undefined)
  })

  it('passes status from search params', async () => {
    mockGetResearchFindings.mockResolvedValueOnce([])

    const request = new Request('http://localhost:3000/api/research/findings?status=actionable')
    await GET(request)

    expect(mockGetResearchFindings).toHaveBeenCalledWith(20, 'actionable')
  })

  it('defaults limit to 20 when not specified', async () => {
    mockGetResearchFindings.mockResolvedValueOnce([])

    const request = new Request('http://localhost:3000/api/research/findings')
    await GET(request)

    expect(mockGetResearchFindings).toHaveBeenCalledWith(20, undefined)
  })
})
