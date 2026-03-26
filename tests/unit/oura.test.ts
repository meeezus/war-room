import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// lib/oura.ts — getOuraHealth unit tests
// ---------------------------------------------------------------------------

describe('getOuraHealth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('returns available: false when OURA_ACCESS_TOKEN is missing', async () => {
    delete process.env.OURA_ACCESS_TOKEN
    const { getOuraHealth } = await import('@/lib/oura')
    const result = await getOuraHealth()
    expect(result).toEqual({
      readiness: null,
      sleep: null,
      available: false,
    })
  })

  it('fetches readiness and sleep scores from Oura API v2', async () => {
    process.env.OURA_ACCESS_TOKEN = 'test-token-123'

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ score: 82 }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ score: 91 }],
        }),
      })

    vi.stubGlobal('fetch', mockFetch)

    const { getOuraHealth } = await import('@/lib/oura')
    const result = await getOuraHealth()

    expect(result).toEqual({
      readiness: 82,
      sleep: 91,
      available: true,
    })

    // Verify correct API endpoints called
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const readinessCall = mockFetch.mock.calls[0][0] as string
    const sleepCall = mockFetch.mock.calls[1][0] as string
    expect(readinessCall).toContain('api.ouraring.com/v2/usercollection/daily_readiness')
    expect(sleepCall).toContain('api.ouraring.com/v2/usercollection/daily_sleep')

    // Verify auth header
    const readinessHeaders = mockFetch.mock.calls[0][1] as RequestInit
    expect(readinessHeaders.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer test-token-123' })
    )
  })

  it('returns nulls when API returns empty data arrays', async () => {
    process.env.OURA_ACCESS_TOKEN = 'test-token-123'

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })

    vi.stubGlobal('fetch', mockFetch)

    const { getOuraHealth } = await import('@/lib/oura')
    const result = await getOuraHealth()

    expect(result).toEqual({
      readiness: null,
      sleep: null,
      available: true,
    })
  })

  it('returns available: false on fetch error', async () => {
    process.env.OURA_ACCESS_TOKEN = 'test-token-123'

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const { getOuraHealth } = await import('@/lib/oura')
    const result = await getOuraHealth()

    expect(result).toEqual({
      readiness: null,
      sleep: null,
      available: false,
    })
  })

  it('uses today date as start_date and end_date', async () => {
    process.env.OURA_ACCESS_TOKEN = 'test-token-123'

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ score: 75 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ score: 80 }] }),
      })

    vi.stubGlobal('fetch', mockFetch)

    const { getOuraHealth } = await import('@/lib/oura')
    await getOuraHealth()

    const today = new Date().toISOString().split('T')[0]
    const readinessUrl = mockFetch.mock.calls[0][0] as string
    expect(readinessUrl).toContain(`start_date=${today}`)
    expect(readinessUrl).toContain(`end_date=${today}`)
  })
})
