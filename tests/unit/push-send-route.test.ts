import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock setup (must happen before import) ----

const mockSendPushToUser = vi.fn()
const mockSendPushBroadcast = vi.fn()

vi.mock('@/lib/push-notifications-server', () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPushToUser(...args),
  sendPushBroadcast: (...args: unknown[]) => mockSendPushBroadcast(...args),
}))

import { POST } from '@/app/api/push/send/route'

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/push/send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when title is missing', async () => {
    const res = await POST(makeRequest({ body: 'Hello' }) as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('title and body required')
  })

  it('returns 400 when body is missing', async () => {
    const res = await POST(makeRequest({ title: 'Alert' }) as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('title and body required')
  })

  it('calls sendPushBroadcast when no userId provided', async () => {
    mockSendPushBroadcast.mockResolvedValue({ sent: 3, failed: 0 })

    const res = await POST(makeRequest({ title: 'Alert', body: 'Broadcast message' }) as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ sent: 3, failed: 0 })

    expect(mockSendPushBroadcast).toHaveBeenCalledWith({
      title: 'Alert',
      body: 'Broadcast message',
      url: undefined,
    })
    expect(mockSendPushToUser).not.toHaveBeenCalled()
  })

  it('calls sendPushToUser when userId is provided', async () => {
    mockSendPushToUser.mockResolvedValue({ sent: 1, failed: 0 })

    const res = await POST(makeRequest({
      title: 'Personal',
      body: 'Just for you',
      userId: 'user-42',
      url: '/dashboard',
    }) as any)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ sent: 1, failed: 0 })

    expect(mockSendPushToUser).toHaveBeenCalledWith('user-42', {
      title: 'Personal',
      body: 'Just for you',
      url: '/dashboard',
    })
    expect(mockSendPushBroadcast).not.toHaveBeenCalled()
  })

  it('passes url through to push functions', async () => {
    mockSendPushBroadcast.mockResolvedValue({ sent: 1, failed: 0 })

    await POST(makeRequest({
      title: 'Alert',
      body: 'Click here',
      url: '/missions/42',
    }) as any)

    expect(mockSendPushBroadcast).toHaveBeenCalledWith({
      title: 'Alert',
      body: 'Click here',
      url: '/missions/42',
    })
  })
})
