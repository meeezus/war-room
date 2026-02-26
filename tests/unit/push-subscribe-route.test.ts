import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock setup (must happen before import) ----

const mockUpsert = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table !== 'push_subscriptions') throw new Error(`Unexpected table: ${table}`)
      return {
        upsert: mockUpsert,
        delete: () => ({
          eq: (col1: string, val1: string) => {
            mockEq(col1, val1)
            return {
              eq: (col2: string, val2: string) => {
                mockDelete(col1, val1, col2, val2)
                return Promise.resolve({ error: null })
              },
            }
          },
        }),
      }
    }),
  })),
}))

import { POST, DELETE } from '@/app/api/push/subscribe/route'

// Helper: create a Request with JSON body
function makeRequest(method: string, body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/push/subscribe', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/push/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when endpoint is missing', async () => {
    const res = await POST(makeRequest('POST', { keys: { p256dh: 'a', auth: 'b' } }) as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid subscription')
  })

  it('returns 400 when keys.p256dh is missing', async () => {
    const res = await POST(makeRequest('POST', { endpoint: 'https://fcm.example.com/abc', keys: { auth: 'b' } }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when keys.auth is missing', async () => {
    const res = await POST(makeRequest('POST', { endpoint: 'https://fcm.example.com/abc', keys: { p256dh: 'a' } }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when keys object is entirely missing', async () => {
    const res = await POST(makeRequest('POST', { endpoint: 'https://fcm.example.com/abc' }) as any)
    expect(res.status).toBe(400)
  })

  it('upserts valid subscription and returns success', async () => {
    mockUpsert.mockResolvedValue({ error: null })

    const res = await POST(makeRequest('POST', {
      endpoint: 'https://fcm.example.com/abc',
      keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
    }) as any)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'sensei',
        endpoint: 'https://fcm.example.com/abc',
        p256dh: 'test-p256dh',
        auth: 'test-auth',
      },
      { onConflict: 'user_id,endpoint' },
    )
  })

  it('returns 500 when supabase upsert fails', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'DB error' } })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(makeRequest('POST', {
      endpoint: 'https://fcm.example.com/abc',
      keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
    }) as any)

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to save')

    consoleSpy.mockRestore()
  })
})

describe('DELETE /api/push/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes subscription by endpoint and returns success', async () => {
    const res = await DELETE(makeRequest('DELETE', {
      endpoint: 'https://fcm.example.com/abc',
    }) as any)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    // Verify the delete chain was called with correct params
    expect(mockDelete).toHaveBeenCalledWith(
      'user_id', 'sensei',
      'endpoint', 'https://fcm.example.com/abc',
    )
  })
})
