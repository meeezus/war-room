import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Usage API Route Tests
// ---------------------------------------------------------------------------
// Tests for app/api/usage/route.ts
// Covers: file-not-found fallback, valid data parsing, response shape

const mockReadCodexBarSnapshot = vi.fn()

vi.mock('@/lib/codexbar', () => ({
  readCodexBarSnapshot: (...args: unknown[]) => mockReadCodexBarSnapshot(...args),
}))

import { GET } from '@/app/api/usage/route'

describe('GET /api/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error object when CodexBar file does not exist', async () => {
    mockReadCodexBarSnapshot.mockResolvedValueOnce({
      error: 'CodexBar not found',
      providers: [],
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      error: 'CodexBar not found',
      providers: [],
    })
  })

  it('returns parsed data when file exists', async () => {
    const mockData = {
      providers: [
        {
          name: 'Claude',
          quotaInfo: {
            percentUsed: 45.2,
            resetTime: '2026-02-27T00:00:00Z',
            windowName: 'daily',
          },
          dailyUsage: [
            { date: '2026-02-26', cost: 12.5, inputTokens: 500000, outputTokens: 200000 },
          ],
          currentSession: {
            cost: 3.45,
            inputTokens: 150000,
            outputTokens: 60000,
          },
        },
      ],
      lastUpdated: '2026-02-26T15:30:00Z',
    }

    mockReadCodexBarSnapshot.mockResolvedValueOnce(mockData)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.providers).toHaveLength(1)
    expect(json.providers[0].name).toBe('Claude')
    expect(json.providers[0].quotaInfo.percentUsed).toBe(45.2)
    expect(json.lastUpdated).toBe('2026-02-26T15:30:00Z')
  })

  it('passes through parse error from codexbar helper', async () => {
    mockReadCodexBarSnapshot.mockResolvedValueOnce({
      error: 'Failed to parse CodexBar data',
      providers: [],
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.providers).toEqual([])
    expect(json.error).toMatch(/parse/i)
  })

  it('passes through unexpected error from codexbar helper', async () => {
    mockReadCodexBarSnapshot.mockResolvedValueOnce({
      error: 'Failed to read CodexBar data: EACCES: permission denied',
      providers: [],
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.providers).toEqual([])
    expect(json.error).toBeDefined()
  })

  it('handles empty providers array gracefully', async () => {
    mockReadCodexBarSnapshot.mockResolvedValueOnce({
      providers: [],
      lastUpdated: '2026-02-26T15:30:00Z',
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.providers).toEqual([])
  })
})
