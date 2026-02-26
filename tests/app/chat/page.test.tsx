import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChatPage from '@/app/chat/page'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
      subscribe: () => ({}),
    }),
    removeChannel: vi.fn(),
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}))

// Track fetch calls
let fetchCalls: { url: string; options?: RequestInit }[] = []

const mockThreads = [
  {
    id: 'thread-1',
    title: 'Test Thread',
    last_message: 'Hello',
    last_message_at: new Date().toISOString(),
    agent_id: 'cc',
  },
]

const mockCategories = [{ id: 'cat-1', name: 'General', collapsed: false }]
const mockChannels = [
  { id: 'ch-1', category_id: 'cat-1', name: 'announcements', is_default: true },
  { id: 'ch-2', category_id: null, name: 'random', is_default: false },
]

const mockChannelMessages = [
  {
    id: 'msg-1',
    channel_id: 'ch-1',
    role: 'assistant',
    content: 'Welcome to announcements',
    agent_id: 'makima',
    reply_to_id: null,
    thread_id: null,
    thread_count: 0,
    forwarded_from: null,
    created_at: new Date().toISOString(),
  },
]

beforeEach(() => {
  fetchCalls = []
  // Reset fetch mock
  global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
    fetchCalls.push({ url: urlStr, options })

    // Thread list
    if (urlStr.includes('/api/chat/threads') && (!options || options.method !== 'POST')) {
      return new Response(JSON.stringify({ threads: mockThreads }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Channels list
    if (urlStr === '/api/channels' && (!options || options.method !== 'POST')) {
      return new Response(
        JSON.stringify({ categories: mockCategories, channels: mockChannels }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Channel messages
    if (urlStr.match(/\/api\/channels\/[\w-]+\/messages/)) {
      return new Response(JSON.stringify(mockChannelMessages), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fallback
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as any
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatPage — Channel Integration', () => {
  describe('channel data fetching', () => {
    it('fetches channels on mount', async () => {
      render(<ChatPage />)

      await waitFor(() => {
        const channelFetch = fetchCalls.find((c) => c.url === '/api/channels')
        expect(channelFetch).toBeDefined()
      })
    })
  })

  describe('UnifiedSidebar rendering', () => {
    it('renders the Direct Messages and Channels tabs', async () => {
      render(<ChatPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /direct messages/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /channels/i })).toBeInTheDocument()
      })
    })
  })

  describe('channel view', () => {
    it('shows channel name header when a channel is selected', async () => {
      render(<ChatPage />)

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /channels/i })).toBeInTheDocument()
      })

      // Switch to Channels tab
      fireEvent.click(screen.getByRole('button', { name: /channels/i }))

      // Wait for channels to appear and click one
      await waitFor(() => {
        const channelBtn = screen.getByText('announcements')
        expect(channelBtn).toBeInTheDocument()
        fireEvent.click(channelBtn)
      })

      // Channel header should appear
      await waitFor(() => {
        expect(screen.getByText('#announcements')).toBeInTheDocument()
      })
    })

    it('fetches channel messages when a channel is selected', async () => {
      render(<ChatPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /channels/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /channels/i }))

      await waitFor(() => {
        const channelBtn = screen.getByText('announcements')
        fireEvent.click(channelBtn)
      })

      await waitFor(() => {
        const msgFetch = fetchCalls.find((c) => c.url?.includes('/api/channels/ch-1/messages'))
        expect(msgFetch).toBeDefined()
      })
    })

    it('displays channel messages', async () => {
      render(<ChatPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /channels/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /channels/i }))

      await waitFor(() => {
        const channelBtn = screen.getByText('announcements')
        fireEvent.click(channelBtn)
      })

      await waitFor(() => {
        expect(screen.getByText('Welcome to announcements')).toBeInTheDocument()
      })
    })

    it('shows read-only notice in channel view', async () => {
      render(<ChatPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /channels/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /channels/i }))

      await waitFor(() => {
        const channelBtn = screen.getByText('announcements')
        fireEvent.click(channelBtn)
      })

      await waitFor(() => {
        expect(
          screen.getByText(/channel messages are read-only/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('DM/Channel switching', () => {
    it('clears channel selection when selecting a DM thread', async () => {
      render(<ChatPage />)

      // Wait for both tabs to render
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /channels/i })).toBeInTheDocument()
      })

      // Switch to channels, select a channel
      fireEvent.click(screen.getByRole('button', { name: /channels/i }))
      await waitFor(() => {
        fireEvent.click(screen.getByText('announcements'))
      })

      // Confirm channel view shows
      await waitFor(() => {
        expect(screen.getByText('#announcements')).toBeInTheDocument()
      })

      // Switch back to DMs
      fireEvent.click(screen.getByRole('button', { name: /direct messages/i }))

      // Select a thread — the DM view should show, not channel view
      await waitFor(() => {
        const threadItem = screen.getByText('Test Thread')
        fireEvent.click(threadItem)
      })

      // Channel header should be gone — DM view should be showing
      await waitFor(() => {
        expect(screen.queryByText('#announcements')).not.toBeInTheDocument()
      })
    })
  })
})
