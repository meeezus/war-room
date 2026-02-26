/**
 * Integration tests verifying that ChatPage uses useRealtimeChannel
 * instead of raw supabase channel subscriptions.
 *
 * RED phase: these tests FAIL before the refactor because the page
 * uses raw channelRef + supabase.channel() directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Hoist mocks — vi.mock factories run before module imports, so shared
// state must be created with vi.hoisted()
// ---------------------------------------------------------------------------

const { useRealtimeChannelMock, mockSupabaseFrom } = vi.hoisted(() => ({
  useRealtimeChannelMock: vi.fn(),
  mockSupabaseFrom: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock useRealtimeChannel — spy on calls so we can assert the page uses it
// ---------------------------------------------------------------------------

vi.mock('@/lib/use-realtime-channel', () => ({
  useRealtimeChannel: useRealtimeChannelMock,
  getRealtimeChannelCount: vi.fn(() => 0),
  getRealtimeChannelNames: vi.fn(() => []),
  _resetRegistryForTesting: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock heavy UI components (they don't affect subscription behavior)
// ---------------------------------------------------------------------------

vi.mock('@/components/chat/unified-sidebar', () => ({
  UnifiedSidebar: () => <div data-testid="sidebar" />,
}))
vi.mock('@/components/chat/message-area', () => ({
  MessageArea: () => <div data-testid="message-area" />,
}))
vi.mock('@/components/chat/channel-message', () => ({
  ChannelMessage: () => <div data-testid="channel-message" />,
}))
vi.mock('@/components/chat/chat-input', () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}))
vi.mock('@/components/chat/agent-selector', () => ({
  AgentSelector: () => <div data-testid="agent-selector" />,
}))
vi.mock('@/components/chat/chat-actions', () => ({
  ChatActions: () => <div data-testid="chat-actions" />,
}))
vi.mock('@/components/chat/thread-panel', () => ({
  ThreadPanel: () => <div data-testid="thread-panel" />,
}))
vi.mock('@/components/chat/forward-modal', () => ({
  ForwardModal: () => <div data-testid="forward-modal" />,
}))

// ---------------------------------------------------------------------------
// Mock next/link
// ---------------------------------------------------------------------------

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

// ---------------------------------------------------------------------------
// Mock lucide-react (avoid SVG rendering issues in jsdom)
// ---------------------------------------------------------------------------

vi.mock('lucide-react', () => ({
  ArrowLeft: () => null,
  ChevronLeft: () => null,
  Hash: () => null,
  Menu: () => null,
  X: () => null,
  Zap: () => null,
}))

// ---------------------------------------------------------------------------
// Mock supabase (used for direct fetchMessages query)
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockSupabaseFrom,
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
global.fetch = mockFetch

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockThread = {
  id: 'thread-123',
  title: 'Test Thread',
  status: 'active',
  agent_id: 'ed',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  last_message_preview: 'hello',
}

function setupFetchMock() {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('/api/chat/threads')) {
      return { ok: true, json: async () => ({ threads: [mockThread] }) }
    }
    if (url.includes('/api/channels')) {
      return { ok: true, json: async () => ({ categories: [], channels: [] }) }
    }
    return { ok: true, json: async () => ({}) }
  })
}

function setupSupabaseMock() {
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  })
}

// ---------------------------------------------------------------------------
// Import ChatPage after all mocks are set up
// ---------------------------------------------------------------------------

import ChatPage from '@/app/chat/page'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatPage realtime subscriptions', () => {
  beforeEach(() => {
    useRealtimeChannelMock.mockReset()
    mockFetch.mockReset()
    mockSupabaseFrom.mockReset()
    setupFetchMock()
    setupSupabaseMock()
  })

  it('subscribes to chat-threads-updates on mount using useRealtimeChannel', async () => {
    await act(async () => {
      render(<ChatPage />)
    })

    const threadChannelCalls = (useRealtimeChannelMock.mock.calls as [string | null, unknown][]).filter(
      ([name]) => name === 'chat-threads-updates'
    )

    expect(threadChannelCalls.length).toBeGreaterThan(0)
  })

  it('passes null to DM channel subscription when no thread is selected', async () => {
    await act(async () => {
      render(<ChatPage />)
    })

    // One of the useRealtimeChannel calls should have null (no active thread yet)
    const nullCalls = (useRealtimeChannelMock.mock.calls as [string | null, unknown][]).filter(
      ([name]) => name === null
    )

    expect(nullCalls.length).toBeGreaterThan(0)
  })

  it('subscribes to chat-messages-{threadId} when an active thread is set', async () => {
    // Setup: provide a thread so auto-selection fires
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/chat/threads')) {
        return { ok: true, json: async () => ({ threads: [mockThread] }) }
      }
      if (url.includes('/api/channels')) {
        return { ok: true, json: async () => ({ categories: [], channels: [] }) }
      }
      return { ok: true, json: async () => ({}) }
    })

    await act(async () => {
      render(<ChatPage />)
    })

    await waitFor(() => {
      const dmCalls = (useRealtimeChannelMock.mock.calls as [string | null, unknown][]).filter(
        ([name]) => name === `chat-messages-${mockThread.id}`
      )
      expect(dmCalls.length).toBeGreaterThan(0)
    })
  })
})
