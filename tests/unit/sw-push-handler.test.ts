import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for the service worker push notification handler logic.
 *
 * Since sw.ts runs in a ServiceWorkerGlobalScope and is compiled by Serwist,
 * we extract the handler logic into a testable module (lib/sw-push-handlers.ts)
 * and test it in isolation with mock ServiceWorker APIs.
 */

// ---------------------------------------------------------------------------
// Mock types for ServiceWorker APIs
// ---------------------------------------------------------------------------

interface MockNotification {
  close: ReturnType<typeof vi.fn>
  data?: { url?: string }
  action?: string
}

interface MockClient {
  url: string
  focus: ReturnType<typeof vi.fn>
}

interface MockClients {
  matchAll: ReturnType<typeof vi.fn>
  openWindow: ReturnType<typeof vi.fn>
}

// ---------------------------------------------------------------------------
// Import the handler logic (will fail until implementation exists)
// ---------------------------------------------------------------------------

import {
  parsePushData,
  buildNotificationOptions,
  handleNotificationClick,
} from '@/lib/sw-push-handlers'

// ---------------------------------------------------------------------------
// parsePushData
// ---------------------------------------------------------------------------

describe('parsePushData', () => {
  it('returns default payload when event.data is null', () => {
    const result = parsePushData(null)
    expect(result).toEqual({
      title: 'War Room',
      body: 'New notification',
    })
  })

  it('parses valid JSON from event.data', () => {
    const data = {
      json: () => ({ title: 'Alert', body: 'Server down', url: '/health' }),
    }
    const result = parsePushData(data as any)
    expect(result).toEqual({ title: 'Alert', body: 'Server down', url: '/health' })
  })

  it('returns default payload when JSON parsing throws', () => {
    const data = {
      json: () => { throw new Error('bad json') },
    }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = parsePushData(data as any)
    expect(result).toEqual({
      title: 'War Room',
      body: 'New notification',
    })
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('preserves all fields from push data', () => {
    const payload = {
      title: 'Mission Update',
      body: 'Phase 2 complete',
      url: '/missions/42',
      extra: 'metadata',
    }
    const data = { json: () => payload }
    const result = parsePushData(data as any)
    expect(result).toEqual(payload)
  })
})

// ---------------------------------------------------------------------------
// buildNotificationOptions
// ---------------------------------------------------------------------------

describe('buildNotificationOptions', () => {
  it('builds options with provided body and url', () => {
    const opts = buildNotificationOptions({
      title: 'Test',
      body: 'Hello world',
      url: '/dashboard',
    })

    expect(opts.body).toBe('Hello world')
    expect(opts.data).toEqual({ url: '/dashboard' })
    expect(opts.icon).toBe('/icon-192.png')
    expect(opts.vibrate).toEqual([100, 50, 100])
    expect(opts.actions).toHaveLength(2)
    expect(opts.actions![0].action).toBe('open')
    expect(opts.actions![1].action).toBe('dismiss')
  })

  it('defaults body to fallback when not provided', () => {
    const opts = buildNotificationOptions({ title: 'Test' })
    expect(opts.body).toBe('You have a new message')
  })

  it('defaults url to /chat when not provided', () => {
    const opts = buildNotificationOptions({ title: 'Test', body: 'hi' })
    expect(opts.data).toEqual({ url: '/chat' })
  })

  it('uses badge icon path', () => {
    const opts = buildNotificationOptions({ title: 'X' })
    expect(opts.badge).toBe('/icon-192.png')
  })
})

// ---------------------------------------------------------------------------
// handleNotificationClick
// ---------------------------------------------------------------------------

describe('handleNotificationClick', () => {
  let mockNotification: MockNotification
  let mockClients: MockClients

  beforeEach(() => {
    mockNotification = {
      close: vi.fn(),
      data: { url: '/chat' },
    }
    mockClients = {
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue(null),
    }
  })

  it('closes the notification', async () => {
    await handleNotificationClick(
      mockNotification as any,
      'open',
      mockClients as any,
    )
    expect(mockNotification.close).toHaveBeenCalled()
  })

  it('does nothing beyond close when action is "dismiss"', async () => {
    await handleNotificationClick(
      mockNotification as any,
      'dismiss',
      mockClients as any,
    )
    expect(mockNotification.close).toHaveBeenCalled()
    expect(mockClients.matchAll).not.toHaveBeenCalled()
    expect(mockClients.openWindow).not.toHaveBeenCalled()
  })

  it('focuses existing client when one matches /chat', async () => {
    const existingClient: MockClient = {
      url: 'https://warroom.app/chat',
      focus: vi.fn().mockResolvedValue(undefined),
    }
    mockClients.matchAll.mockResolvedValue([existingClient])

    await handleNotificationClick(
      mockNotification as any,
      'open',
      mockClients as any,
    )

    expect(existingClient.focus).toHaveBeenCalled()
    expect(mockClients.openWindow).not.toHaveBeenCalled()
  })

  it('opens new window when no existing client matches', async () => {
    mockClients.matchAll.mockResolvedValue([])

    await handleNotificationClick(
      mockNotification as any,
      'open',
      mockClients as any,
    )

    expect(mockClients.openWindow).toHaveBeenCalledWith('/chat')
  })

  it('opens the url from notification data', async () => {
    mockNotification.data = { url: '/missions/5' }
    mockClients.matchAll.mockResolvedValue([])

    await handleNotificationClick(
      mockNotification as any,
      'open',
      mockClients as any,
    )

    expect(mockClients.openWindow).toHaveBeenCalledWith('/missions/5')
  })

  it('defaults to /chat when notification data has no url', async () => {
    mockNotification.data = undefined
    mockClients.matchAll.mockResolvedValue([])

    await handleNotificationClick(
      mockNotification as any,
      'open',
      mockClients as any,
    )

    expect(mockClients.openWindow).toHaveBeenCalledWith('/chat')
  })

  it('skips client that does not contain target path', async () => {
    const nonMatchingClient: MockClient = {
      url: 'https://warroom.app/dashboard',
      focus: vi.fn(),
    }
    mockClients.matchAll.mockResolvedValue([nonMatchingClient])
    mockNotification.data = { url: '/chat' }

    await handleNotificationClick(
      mockNotification as any,
      'open',
      mockClients as any,
    )

    expect(nonMatchingClient.focus).not.toHaveBeenCalled()
    expect(mockClients.openWindow).toHaveBeenCalledWith('/chat')
  })

  it('focuses client matching custom url path', async () => {
    const matchingClient: MockClient = {
      url: 'https://warroom.app/missions/5',
      focus: vi.fn().mockResolvedValue(undefined),
    }
    mockClients.matchAll.mockResolvedValue([matchingClient])
    mockNotification.data = { url: '/missions/5' }

    await handleNotificationClick(
      mockNotification as any,
      'open',
      mockClients as any,
    )

    expect(matchingClient.focus).toHaveBeenCalled()
    expect(mockClients.openWindow).not.toHaveBeenCalled()
  })
})
