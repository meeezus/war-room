import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ChannelsPage from '@/app/channels/page'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Default API responses
const mockCategories = [
  { id: 'cat-1', name: 'General', position: 0, collapsed: false, created_at: '2025-01-01T00:00:00Z' },
  { id: 'cat-2', name: 'Projects', position: 1, collapsed: true, created_at: '2025-01-01T00:00:00Z' },
]

const mockChannels = [
  { id: 'ch-1', category_id: 'cat-1', name: 'announcements', is_default: true, position: 0, created_at: '2025-01-01T00:00:00Z' },
  { id: 'ch-2', category_id: 'cat-1', name: 'random', is_default: false, position: 1, created_at: '2025-01-01T00:00:00Z' },
  { id: 'ch-3', category_id: 'cat-2', name: 'alpha', is_default: false, position: 2, created_at: '2025-01-01T00:00:00Z' },
]

const mockMessages = [
  {
    id: 'msg-1',
    channel_id: 'ch-1',
    role: 'user' as const,
    content: 'Hello world',
    agent_id: null,
    reply_to_id: null,
    thread_id: null,
    thread_count: 0,
    forwarded_from: null,
    created_at: '2025-01-01T10:00:00Z',
  },
  {
    id: 'msg-2',
    channel_id: 'ch-1',
    role: 'assistant' as const,
    content: 'Hello from assistant',
    agent_id: 'makima',
    reply_to_id: null,
    thread_id: null,
    thread_count: 2,
    forwarded_from: null,
    created_at: '2025-01-01T10:01:00Z',
  },
]

function setupFetchMock() {
  mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : String(url)

    // GET /api/channels — categories + channels list
    if (urlStr === '/api/channels' && (!options || options.method === 'GET' || !options.method)) {
      return {
        ok: true,
        json: async () => ({ categories: mockCategories, channels: mockChannels }),
      }
    }

    // GET /api/channels/:id/messages — channel messages
    if (urlStr.match(/\/api\/channels\/[\w-]+\/messages/) && (!options || !options.method || options.method === 'GET')) {
      return {
        ok: true,
        json: async () => mockMessages,
      }
    }

    // POST /api/channels/:id/messages — send message
    if (urlStr.match(/\/api\/channels\/[\w-]+\/messages/) && options?.method === 'POST') {
      const body = JSON.parse(options.body as string)
      return {
        ok: true,
        json: async () => ({
          id: `msg-new-${Date.now()}`,
          channel_id: 'ch-1',
          role: body.role || 'user',
          content: body.content,
          agent_id: body.agentId || null,
          reply_to_id: body.replyToId || null,
          thread_id: body.threadId || null,
          thread_count: 0,
          forwarded_from: null,
          created_at: new Date().toISOString(),
        }),
      }
    }

    // POST /api/channels — create channel or category
    if (urlStr === '/api/channels' && options?.method === 'POST') {
      const body = JSON.parse(options.body as string)
      if (body.type === 'category') {
        return {
          ok: true,
          json: async () => ({ id: 'cat-new', name: body.name, position: 10, collapsed: false, created_at: new Date().toISOString() }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          id: 'ch-new',
          category_id: body.categoryId,
          name: body.name,
          is_default: false,
          position: 10,
          created_at: new Date().toISOString(),
        }),
      }
    }

    // Default fallback
    return { ok: true, json: async () => ({}) }
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChannelsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupFetchMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial render and data fetching', () => {
    it('renders the page with sidebar and main area', async () => {
      render(<ChannelsPage />)

      // Should fetch categories + channels on mount
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/channels')
      })
    })

    it('fetches categories and channels on mount', async () => {
      render(<ChannelsPage />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/channels')
      })
    })

    it('auto-selects the default channel after loading', async () => {
      render(<ChannelsPage />)

      // After fetching channels, should auto-select default channel (ch-1)
      // and then fetch its messages
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/\/api\/channels\/ch-1\/messages/)
        )
      })
    })

    it('shows channel name in header when channel is selected', async () => {
      render(<ChannelsPage />)

      await waitFor(() => {
        expect(screen.getByText('announcements')).toBeInTheDocument()
      })
    })

    it('renders messages for the active channel', async () => {
      render(<ChannelsPage />)

      await waitFor(() => {
        expect(screen.getByText('Hello world')).toBeInTheDocument()
        expect(screen.getByText('Hello from assistant')).toBeInTheDocument()
      })
    })
  })

  describe('message sending', () => {
    it('sends a message via POST when user submits', async () => {
      render(<ChannelsPage />)

      // Wait for channel to load
      await waitFor(() => {
        expect(screen.getByText('Hello world')).toBeInTheDocument()
      })

      // Find the textarea and type a message
      const textarea = screen.getByPlaceholderText(/send a message/i)
      fireEvent.change(textarea, { target: { value: 'New message' } })

      // Submit with enter key
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

      await waitFor(() => {
        const postCalls = mockFetch.mock.calls.filter(
          ([url, opts]: [string, RequestInit | undefined]) =>
            typeof url === 'string' &&
            url.includes('/messages') &&
            opts?.method === 'POST'
        )
        expect(postCalls.length).toBeGreaterThanOrEqual(1)
        const body = JSON.parse(postCalls[0][1].body as string)
        expect(body.content).toBe('New message')
        expect(body.role).toBe('user')
      })
    })
  })

  describe('thread panel', () => {
    it('opens thread panel when thread badge is clicked', async () => {
      render(<ChannelsPage />)

      // Wait for messages to render
      await waitFor(() => {
        expect(screen.getByText('Hello from assistant')).toBeInTheDocument()
      })

      // msg-2 has thread_count: 2, so it should show a thread badge
      const threadBadge = screen.getByTestId('thread-badge')
      expect(threadBadge).toBeInTheDocument()
      fireEvent.click(threadBadge)

      await waitFor(() => {
        expect(screen.getByTestId('thread-panel')).toBeInTheDocument()
      })
    })
  })

  describe('reply functionality', () => {
    it('shows reply indicator when replying to a message', async () => {
      render(<ChannelsPage />)

      await waitFor(() => {
        expect(screen.getByText('Hello world')).toBeInTheDocument()
      })

      // Hover over a message to make action buttons appear
      const messageDivs = screen.getAllByTestId('channel-message')
      fireEvent.mouseEnter(messageDivs[0])

      // Action buttons use title attribute (Reply, Forward, Start thread)
      await waitFor(() => {
        expect(screen.getByTitle('Reply')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTitle('Reply'))

      await waitFor(() => {
        expect(screen.getByText(/replying to/i)).toBeInTheDocument()
      })
    })
  })

  describe('forward functionality', () => {
    it('opens forward modal when forward action is triggered', async () => {
      render(<ChannelsPage />)

      await waitFor(() => {
        expect(screen.getByText('Hello world')).toBeInTheDocument()
      })

      // Hover over a message to show action buttons
      const messageDivs = screen.getAllByTestId('channel-message')
      fireEvent.mouseEnter(messageDivs[0])

      await waitFor(() => {
        expect(screen.getByTitle('Forward')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTitle('Forward'))

      await waitFor(() => {
        expect(screen.getByText('Forward to channel')).toBeInTheDocument()
      })
    })
  })

  describe('empty state', () => {
    it('shows empty state when no channel is selected', async () => {
      // Override fetch to return no default channel
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/api/channels') {
          return {
            ok: true,
            json: async () => ({
              categories: [],
              channels: [],
            }),
          }
        }
        return { ok: true, json: async () => ({}) }
      })

      render(<ChannelsPage />)

      await waitFor(() => {
        expect(screen.getByText(/select a channel/i)).toBeInTheDocument()
      })
    })
  })

  describe('navigation', () => {
    it('has a back link to dashboard', async () => {
      render(<ChannelsPage />)
      const backLink = screen.getByRole('link', { name: /back/i }) || screen.getByLabelText(/back/i)
      expect(backLink).toBeInTheDocument()
      expect(backLink).toHaveAttribute('href', '/dashboard')
    })
  })
})
