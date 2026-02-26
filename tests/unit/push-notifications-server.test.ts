import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---- Mock setup (must happen before import) ----

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSendNotification = vi.fn()

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}))

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table !== 'push_subscriptions') throw new Error(`Unexpected table: ${table}`)
      return {
        select: (cols: string) => {
          mockSelect(cols)
          return {
            eq: (col: string, val: string) => {
              mockEq(col, val)
              return Promise.resolve({ data: mockSubsData, error: null })
            },
            then: (resolve: (v: { data: unknown; error: null }) => void) =>
              resolve({ data: mockSubsData, error: null }),
          }
        },
      }
    }),
  })),
}))

// Mutable test data
let mockSubsData: Array<{ endpoint: string; p256dh: string; auth: string }> | null = null

// Set env vars before importing module
const originalEnv = { ...process.env }

describe('push-notifications-server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubsData = null
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key'
    process.env.VAPID_PRIVATE_KEY = 'test-private-key'
    process.env.VAPID_SUBJECT = 'mailto:test@example.com'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  describe('sendPushToUser', () => {
    it('returns {sent:0, failed:0} when VAPID keys are not set', async () => {
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      delete process.env.VAPID_PRIVATE_KEY

      const { sendPushToUser } = await import('@/lib/push-notifications-server')
      const result = await sendPushToUser('user-1', { title: 'Test', body: 'Hello' })
      expect(result).toEqual({ sent: 0, failed: 0 })
    })

    it('returns {sent:0, failed:0} when user has no subscriptions', async () => {
      mockSubsData = []
      const { sendPushToUser } = await import('@/lib/push-notifications-server')
      const result = await sendPushToUser('user-1', { title: 'Test', body: 'Hello' })
      expect(result).toEqual({ sent: 0, failed: 0 })
    })

    it('returns {sent:0, failed:0} when subscriptions query returns null', async () => {
      mockSubsData = null
      const { sendPushToUser } = await import('@/lib/push-notifications-server')
      const result = await sendPushToUser('user-1', { title: 'Test', body: 'Hello' })
      expect(result).toEqual({ sent: 0, failed: 0 })
    })

    it('sends notification to all user subscriptions', async () => {
      mockSubsData = [
        { endpoint: 'https://fcm.example.com/1', p256dh: 'key1', auth: 'auth1' },
        { endpoint: 'https://fcm.example.com/2', p256dh: 'key2', auth: 'auth2' },
      ]
      mockSendNotification.mockResolvedValue({})

      const { sendPushToUser } = await import('@/lib/push-notifications-server')
      const result = await sendPushToUser('user-1', { title: 'Alert', body: 'Something happened', url: '/dashboard' })

      expect(result).toEqual({ sent: 2, failed: 0 })
      expect(mockSendNotification).toHaveBeenCalledTimes(2)

      // Verify first call structure
      const [sub, body] = mockSendNotification.mock.calls[0]
      expect(sub.endpoint).toBe('https://fcm.example.com/1')
      expect(sub.keys).toEqual({ p256dh: 'key1', auth: 'auth1' })

      const parsed = JSON.parse(body)
      expect(parsed.title).toBe('Alert')
      expect(parsed.body).toBe('Something happened')
      expect(parsed.url).toBe('/dashboard')
    })

    it('filters by user_id when querying subscriptions', async () => {
      mockSubsData = []
      const { sendPushToUser } = await import('@/lib/push-notifications-server')
      await sendPushToUser('user-42', { title: 'Test', body: 'Hello' })

      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-42')
    })

    it('counts failed notifications correctly', async () => {
      mockSubsData = [
        { endpoint: 'https://fcm.example.com/1', p256dh: 'key1', auth: 'auth1' },
        { endpoint: 'https://fcm.example.com/2', p256dh: 'key2', auth: 'auth2' },
        { endpoint: 'https://fcm.example.com/3', p256dh: 'key3', auth: 'auth3' },
      ]
      mockSendNotification
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ statusCode: 410, message: 'Gone' })
        .mockResolvedValueOnce({})

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const { sendPushToUser } = await import('@/lib/push-notifications-server')
      const result = await sendPushToUser('user-1', { title: 'Test', body: 'Hello' })

      expect(result).toEqual({ sent: 2, failed: 1 })
      consoleSpy.mockRestore()
    })

    it('defaults url to /chat when not provided', async () => {
      mockSubsData = [
        { endpoint: 'https://fcm.example.com/1', p256dh: 'key1', auth: 'auth1' },
      ]
      mockSendNotification.mockResolvedValue({})

      const { sendPushToUser } = await import('@/lib/push-notifications-server')
      await sendPushToUser('user-1', { title: 'Test', body: 'Hello' })

      const [, body] = mockSendNotification.mock.calls[0]
      const parsed = JSON.parse(body)
      expect(parsed.url).toBe('/chat')
    })
  })

  describe('sendPushBroadcast', () => {
    it('returns {sent:0, failed:0} when VAPID keys are not set', async () => {
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      delete process.env.VAPID_PRIVATE_KEY

      const { sendPushBroadcast } = await import('@/lib/push-notifications-server')
      const result = await sendPushBroadcast({ title: 'Test', body: 'Hello' })
      expect(result).toEqual({ sent: 0, failed: 0 })
    })

    it('sends to all subscriptions without user filter', async () => {
      mockSubsData = [
        { endpoint: 'https://fcm.example.com/1', p256dh: 'key1', auth: 'auth1' },
      ]
      mockSendNotification.mockResolvedValue({})

      const { sendPushBroadcast } = await import('@/lib/push-notifications-server')
      const result = await sendPushBroadcast({ title: 'Broadcast', body: 'To all' })

      expect(result).toEqual({ sent: 1, failed: 0 })
      expect(mockSendNotification).toHaveBeenCalledTimes(1)
      // Broadcast should NOT call .eq() for user_id filtering
      expect(mockEq).not.toHaveBeenCalled()
    })

    it('returns {sent:0, failed:0} when no subscriptions exist', async () => {
      mockSubsData = []
      const { sendPushBroadcast } = await import('@/lib/push-notifications-server')
      const result = await sendPushBroadcast({ title: 'Test', body: 'Hello' })
      expect(result).toEqual({ sent: 0, failed: 0 })
    })
  })
})
