import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Research Scan Cron Route Tests
// ---------------------------------------------------------------------------
// Tests for app/api/cron/research-scan/route.ts

// Mock the research-scan module
const mockRunResearchScan = vi.fn()
vi.mock('@/lib/research-scan', () => ({
  runResearchScan: (...args: unknown[]) => mockRunResearchScan(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn(),
}))

import { GET } from '@/app/api/cron/research-scan/route'

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/cron/research-scan', {
    headers,
  })
}

describe('GET /api/cron/research-scan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 when CRON_SECRET is set and auth header is wrong', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')
    const res = await GET(makeRequest({ authorization: 'Bearer wrong' }))
    expect(res.status).toBe(401)
  })

  it('allows request when CRON_SECRET matches', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')
    mockRunResearchScan.mockResolvedValueOnce({ inserted: 3, topicsSearched: 5 })

    const res = await GET(makeRequest({ authorization: 'Bearer my-secret' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inserted).toBe(3)
  })

  it('allows request when no CRON_SECRET is configured', async () => {
    vi.stubEnv('CRON_SECRET', '')
    mockRunResearchScan.mockResolvedValueOnce({ inserted: 0, topicsSearched: 5 })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })

  it('returns scan results in response body', async () => {
    vi.stubEnv('CRON_SECRET', '')
    mockRunResearchScan.mockResolvedValueOnce({ inserted: 7, topicsSearched: 5 })

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body).toEqual({
      status: 'ok',
      inserted: 7,
      topicsSearched: 5,
    })
  })

  it('returns 500 on scan error', async () => {
    vi.stubEnv('CRON_SECRET', '')
    mockRunResearchScan.mockRejectedValueOnce(new Error('Supabase down'))

    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
