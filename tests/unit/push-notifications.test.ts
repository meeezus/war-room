import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We test the pure utility function and the exported API functions
// by mocking browser globals (navigator.serviceWorker, PushManager, fetch)

describe('push-notifications client helpers', () => {
  let subscribeToPush: () => Promise<boolean>
  let unsubscribeFromPush: () => Promise<boolean>
  let isPushSubscribed: () => Promise<boolean>

  const mockSubscription = {
    endpoint: 'https://fcm.example.com/abc',
    toJSON: () => ({
      endpoint: 'https://fcm.example.com/abc',
      keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  }

  const mockPushManager = {
    subscribe: vi.fn().mockResolvedValue(mockSubscription),
    getSubscription: vi.fn().mockResolvedValue(mockSubscription),
  }

  const mockRegistration = {
    pushManager: mockPushManager,
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Mock navigator.serviceWorker
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve(mockRegistration),
      },
      writable: true,
      configurable: true,
    })

    // Mock PushManager on window
    Object.defineProperty(globalThis.window, 'PushManager', {
      value: class {},
      writable: true,
      configurable: true,
    })

    // Mock VAPID key
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BNmUTH-testkey123456789012345678901234567890123456789012345678901234567890')

    // Mock fetch
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })

    // Dynamic import to pick up mocks
    const mod = await import('@/lib/push-notifications')
    subscribeToPush = mod.subscribeToPush
    unsubscribeFromPush = mod.unsubscribeFromPush
    isPushSubscribed = mod.isPushSubscribed
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('subscribeToPush', () => {
    it('returns true on successful subscription', async () => {
      const result = await subscribeToPush()
      expect(result).toBe(true)
      expect(mockPushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(ArrayBuffer),
      })
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockSubscription.toJSON()),
      })
    })

    it('returns false when serviceWorker is not available', async () => {
      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      vi.resetModules()
      const mod = await import('@/lib/push-notifications')
      const result = await mod.subscribeToPush()
      expect(result).toBe(false)
    })

    it('returns false when VAPID key is missing', async () => {
      vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '')
      vi.resetModules()

      // Re-setup navigator mocks for fresh module
      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: { ready: Promise.resolve(mockRegistration) },
        writable: true,
        configurable: true,
      })
      Object.defineProperty(globalThis.window, 'PushManager', {
        value: class {},
        writable: true,
        configurable: true,
      })

      const mod = await import('@/lib/push-notifications')
      const result = await mod.subscribeToPush()
      expect(result).toBe(false)
    })

    it('returns false when fetch fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false })
      vi.resetModules()

      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: { ready: Promise.resolve(mockRegistration) },
        writable: true,
        configurable: true,
      })
      Object.defineProperty(globalThis.window, 'PushManager', {
        value: class {},
        writable: true,
        configurable: true,
      })
      vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BNmUTH-testkey123456789012345678901234567890')

      const mod = await import('@/lib/push-notifications')
      const result = await mod.subscribeToPush()
      expect(result).toBe(false)
    })
  })

  describe('unsubscribeFromPush', () => {
    it('returns true on successful unsubscription', async () => {
      const result = await unsubscribeFromPush()
      expect(result).toBe(true)
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: mockSubscription.endpoint }),
      })
      expect(mockSubscription.unsubscribe).toHaveBeenCalled()
    })

    it('returns true when no existing subscription', async () => {
      mockPushManager.getSubscription.mockResolvedValueOnce(null)
      const result = await unsubscribeFromPush()
      expect(result).toBe(true)
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })
  })

  describe('isPushSubscribed', () => {
    it('returns true when subscription exists', async () => {
      const result = await isPushSubscribed()
      expect(result).toBe(true)
    })

    it('returns false when no subscription exists', async () => {
      mockPushManager.getSubscription.mockResolvedValueOnce(null)
      const result = await isPushSubscribed()
      expect(result).toBe(false)
    })
  })
})

describe('urlBase64ToUint8Array (via subscribeToPush)', () => {
  it('correctly converts a base64url VAPID key to Uint8Array', async () => {
    // We test this indirectly - subscribeToPush passes the result to pushManager.subscribe
    // The applicationServerKey should be a Uint8Array
    const mockPM = {
      subscribe: vi.fn().mockResolvedValue({
        toJSON: () => ({ endpoint: 'x', keys: { p256dh: 'a', auth: 'b' } }),
      }),
      getSubscription: vi.fn().mockResolvedValue(null),
    }

    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ pushManager: mockPM }) },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis.window, 'PushManager', {
      value: class {},
      writable: true,
      configurable: true,
    })

    // Valid base64url-encoded 65-byte P-256 public key
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BEl62iUYgUivxIkv69yViXuGHaE0GNTsGpISNOFn1bKUqLqHoJBYNPYOPqd9GEGzVlMBbfNxPE_SpKFgJWkxODA')
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })

    vi.resetModules()
    const mod = await import('@/lib/push-notifications')
    await mod.subscribeToPush()

    const callArgs = mockPM.subscribe.mock.calls[0][0]
    expect(callArgs.applicationServerKey).toBeInstanceOf(ArrayBuffer)
    expect(callArgs.applicationServerKey.byteLength).toBeGreaterThan(0)
  })
})
