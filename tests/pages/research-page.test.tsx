import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Research Page Tests
// ---------------------------------------------------------------------------

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/research',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Research Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock: return empty findings
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ findings: [] }),
    })
    // Reset modules so page re-imports fresh
    vi.resetModules()
  })

  it('renders without crashing', async () => {
    const { default: ResearchPage } = await import('@/app/research/page')
    const { container } = render(<ResearchPage />)
    expect(container).toBeTruthy()
  })

  it('renders source filter tabs', async () => {
    const { default: ResearchPage } = await import('@/app/research/page')
    render(<ResearchPage />)
    // Should have filter tabs for sources
    await waitFor(() => {
      expect(screen.getByText('All')).toBeTruthy()
    })
  })

  it('renders status filter tabs', async () => {
    const { default: ResearchPage } = await import('@/app/research/page')
    render(<ResearchPage />)
    await waitFor(() => {
      expect(screen.getByText(/new/i)).toBeTruthy()
    })
  })

  it('renders empty state when no findings', async () => {
    const { default: ResearchPage } = await import('@/app/research/page')
    render(<ResearchPage />)
    await waitFor(() => {
      expect(screen.getByText(/no findings/i)).toBeTruthy()
    })
  })

  it('fetches findings on mount', async () => {
    const { default: ResearchPage } = await import('@/app/research/page')
    render(<ResearchPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/research/findings')
      )
    })
  })

  it('renders findings when data is present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        findings: [
          {
            id: '1',
            source: 'twitter',
            title: 'AI Agents Breakthrough',
            summary: 'New paper on agent architectures',
            relevance: 'high',
            status: 'new',
            tags: ['ai', 'agents'],
            url: 'https://twitter.com/test/status/1',
            metadata: {},
            created_at: '2026-03-25T12:00:00Z',
            updated_at: '2026-03-25T12:00:00Z',
          },
        ],
      }),
    })

    const { default: ResearchPage } = await import('@/app/research/page')
    render(<ResearchPage />)
    await waitFor(() => {
      expect(screen.getByText('AI Agents Breakthrough')).toBeTruthy()
    })
  })
})
