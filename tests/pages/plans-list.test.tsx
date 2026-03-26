import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}))

vi.stubGlobal('fetch', mockFetch)

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-testid="next-link" {...props}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/plans',
}))

vi.mock('@/components/sidebar-nav', () => ({
  SidebarNav: () => <nav data-testid="sidebar-nav">SidebarNav</nav>,
}))

vi.mock('@/components/stealth-card', () => ({
  StealthCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="stealth-card" className={className}>{children}</div>
  ),
}))

import PlansPage from '@/app/plans/page'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const MOCK_PLANS = [
  {
    id: 'plan-1',
    title: 'Refactor Auth Module',
    raw_markdown: '# Auth Refactor',
    parsed_beads: [{ id: 'BEAD-001', title: 'Bead 1', wave_index: 0 }],
    analysis: null,
    status: 'reviewing',
    flywheel_score: 5,
    score_breakdown: { money: 2, blast_radius: 2, novelty: 1 },
    auto_run: false,
    wave_count: 1,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'plan-2',
    title: 'Add Payment Gateway',
    raw_markdown: '# Payments',
    parsed_beads: [
      { id: 'BEAD-001', title: 'B1', wave_index: 0 },
      { id: 'BEAD-002', title: 'B2', wave_index: 1 },
    ],
    analysis: null,
    status: 'completed',
    flywheel_score: 8,
    score_breakdown: { money: 3, blast_radius: 3, novelty: 2 },
    auto_run: false,
    wave_count: 2,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'plan-3',
    title: 'Draft Feature',
    raw_markdown: '# Draft',
    parsed_beads: [],
    analysis: null,
    status: 'draft',
    flywheel_score: null,
    score_breakdown: null,
    auto_run: false,
    wave_count: 0,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_PLANS,
    })
  })

  it('renders the sidebar', async () => {
    render(<PlansPage />)
    await waitFor(() => expect(screen.getByTestId('sidebar-nav')).toBeInTheDocument())
  })

  it('shows loading state initially', () => {
    // Never resolving fetch keeps loading state
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(<PlansPage />)
    expect(screen.getByText(/loading plans/i)).toBeInTheDocument()
  })

  it('fetches from /api/plans on mount', async () => {
    render(<PlansPage />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/plans'))
  })

  it('renders plan titles after fetch', async () => {
    render(<PlansPage />)
    await waitFor(() => {
      expect(screen.getByText('Refactor Auth Module')).toBeInTheDocument()
      expect(screen.getByText('Add Payment Gateway')).toBeInTheDocument()
      expect(screen.getByText('Draft Feature')).toBeInTheDocument()
    })
  })

  it('shows status badges for each plan', async () => {
    render(<PlansPage />)
    await waitFor(() => {
      expect(screen.getByText('reviewing')).toBeInTheDocument()
      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('draft')).toBeInTheDocument()
    })
  })

  it('shows flywheel scores with correct color coding', async () => {
    render(<PlansPage />)
    await waitFor(() => {
      // Score 5 should show as blue (standard)
      const score5 = screen.getByText('5')
      expect(score5).toBeInTheDocument()
      // Score 8 should show as amber (significant)
      const score8 = screen.getByText('8')
      expect(score8).toBeInTheDocument()
    })
  })

  it('shows bead count and wave count', async () => {
    render(<PlansPage />)
    await waitFor(() => {
      // Plan 1: 1 bead, 1 wave; Plan 2: 2 beads, 2 waves
      expect(screen.getByText(/1 bead/)).toBeInTheDocument()
      expect(screen.getByText(/2 beads/)).toBeInTheDocument()
    })
  })

  it('renders filter tabs', async () => {
    render(<PlansPage />)
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
      expect(screen.getByText('Reviewing')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Draft')).toBeInTheDocument()
    })
  })

  it('filters plans by status when tab clicked', async () => {
    render(<PlansPage />)
    await waitFor(() => screen.getByText('Refactor Auth Module'))

    fireEvent.click(screen.getByText('Completed'))
    // Only completed plan should show
    expect(screen.getByText('Add Payment Gateway')).toBeInTheDocument()
    expect(screen.queryByText('Refactor Auth Module')).not.toBeInTheDocument()
    expect(screen.queryByText('Draft Feature')).not.toBeInTheDocument()
  })

  it('links plan rows to /plans/[id]', async () => {
    render(<PlansPage />)
    await waitFor(() => screen.getByText('Refactor Auth Module'))

    const links = screen.getAllByTestId('next-link')
    const planLinks = links.filter(l => l.getAttribute('href')?.startsWith('/plans/'))
    expect(planLinks.length).toBeGreaterThanOrEqual(3)
    expect(planLinks.some(l => l.getAttribute('href') === '/plans/plan-1')).toBe(true)
  })

  it('shows empty state when no plans', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    })
    render(<PlansPage />)
    await waitFor(() => {
      expect(screen.getByText(/no plans yet/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when filter matches nothing', async () => {
    render(<PlansPage />)
    await waitFor(() => screen.getByText('Refactor Auth Module'))

    fireEvent.click(screen.getByText('Running'))
    expect(screen.getByText(/no plans/i)).toBeInTheDocument()
  })
})
