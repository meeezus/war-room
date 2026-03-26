import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockFetch, mockParams } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockParams: { id: 'plan-abc' },
}))

vi.stubGlobal('fetch', mockFetch)

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-testid="next-link" {...props}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/plans/plan-abc',
  useParams: () => mockParams,
}))

vi.mock('@/components/sidebar-nav', () => ({
  SidebarNav: () => <nav data-testid="sidebar-nav">SidebarNav</nav>,
}))

vi.mock('@/components/stealth-card', () => ({
  StealthCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="stealth-card" className={className}>{children}</div>
  ),
}))

vi.mock('@/components/plan-wave-graph', () => ({
  PlanWaveGraph: ({ beads }: { beads: unknown[] }) => (
    <div data-testid="plan-wave-graph">wave-graph ({beads?.length ?? 0} beads)</div>
  ),
}))

import PlanDetailPage from '@/app/plans/[id]/page'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const MOCK_PLAN = {
  id: 'plan-abc',
  title: 'Deploy Notification System',
  raw_markdown: '# Notification System\n\n## BEAD-001: Setup\nCreate notification service',
  parsed_beads: [
    {
      id: 'BEAD-001',
      title: 'Setup notification service',
      description: 'Create the base notification service',
      dependencies: [],
      blocks: ['BEAD-002'],
      size: 'M',
      accept: ['Service responds to health check'],
      files: ['lib/notifications.ts'],
      repo: 'war-room',
      domain: 'engineering',
      wave_index: 0,
    },
    {
      id: 'BEAD-002',
      title: 'Wire up channels',
      description: 'Connect Discord, email, SMS',
      dependencies: ['BEAD-001'],
      blocks: [],
      size: 'L',
      accept: ['Messages delivered'],
      files: ['lib/channels.ts'],
      repo: 'war-room',
      domain: 'engineering',
      wave_index: 1,
    },
  ],
  analysis: {
    depth: 'polyclaude',
    pushback: ['Consider rate limiting'],
    alternatives: ['Use AWS SNS instead'],
    blind_spots: ['No retry mechanism'],
    recommendation: 'Proceed with caution',
    analyzed_at: new Date().toISOString(),
  },
  status: 'reviewing',
  flywheel_score: 6,
  score_breakdown: { money: 2, blast_radius: 2, novelty: 2 },
  auto_run: false,
  wave_count: 2,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PlanDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_PLAN,
    })
  })

  it('renders sidebar', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => expect(screen.getByTestId('sidebar-nav')).toBeInTheDocument())
  })

  it('fetches plan from /api/plans/[id]', async () => {
    render(<PlanDetailPage />)
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('/api/plans/plan-abc')
    )
  })

  it('shows plan title', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => {
      const titles = screen.getAllByText('Deploy Notification System')
      expect(titles.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows status badge', async () => {
    render(<PlanDetailPage />)
    await waitFor(() =>
      expect(screen.getByText('reviewing')).toBeInTheDocument()
    )
  })

  it('shows flywheel score badge', async () => {
    render(<PlanDetailPage />)
    await waitFor(() =>
      expect(screen.getByText('6')).toBeInTheDocument()
    )
  })

  it('shows bead count and wave count in meta', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => {
      // The meta span contains "2 beads . 2 waves" with middot
      const candidates = screen.getAllByText(/2 beads/)
      const meta = candidates.find(el => el.textContent?.includes('2 waves'))
      expect(meta).toBeTruthy()
    })
  })

  it('renders outcome summary with bead titles as bullets', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => {
      expect(screen.getByText(/what this achieves/i)).toBeInTheDocument()
      expect(screen.getByText('Setup notification service')).toBeInTheDocument()
      expect(screen.getByText('Wire up channels')).toBeInTheDocument()
    })
  })

  it('renders analysis card with pushback, alternatives, blind spots', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Consider rate limiting')).toBeInTheDocument()
      expect(screen.getByText('Use AWS SNS instead')).toBeInTheDocument()
      expect(screen.getByText('No retry mechanism')).toBeInTheDocument()
      expect(screen.getByText('Proceed with caution')).toBeInTheDocument()
    })
  })

  it('shows analysis depth badge', async () => {
    render(<PlanDetailPage />)
    await waitFor(() =>
      expect(screen.getByText('polyclaude')).toBeInTheDocument()
    )
  })

  it('renders the wave graph component', async () => {
    render(<PlanDetailPage />)
    await waitFor(() =>
      expect(screen.getByTestId('plan-wave-graph')).toBeInTheDocument()
    )
  })

  it('shows Approve & Execute button when status is reviewing', async () => {
    render(<PlanDetailPage />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    )
  })

  it('shows disabled Edit button', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => {
      const editBtn = screen.getByRole('button', { name: /edit/i })
      expect(editBtn).toBeDisabled()
    })
  })

  it('shows View Raw Plan toggle', async () => {
    render(<PlanDetailPage />)
    await waitFor(() =>
      expect(screen.getByText(/view raw plan/i)).toBeInTheDocument()
    )
  })

  it('raw markdown is collapsed by default', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => screen.getByText(/what this achieves/i))
    // Raw markdown text should not be visible initially
    expect(screen.queryByText('# Notification System')).not.toBeInTheDocument()
  })

  it('expands raw markdown when toggle clicked', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => screen.getByText(/what this achieves/i))

    fireEvent.click(screen.getByText(/view raw plan/i))
    expect(screen.getByText(/# Notification System/)).toBeInTheDocument()
  })

  it('hides approve button when status is running', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...MOCK_PLAN, status: 'running' }),
    })
    render(<PlanDetailPage />)
    await waitFor(() => screen.getByText(/what this achieves/i))
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
  })

  it('disables approve button and shows pulse when status is analyzing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...MOCK_PLAN, status: 'analyzing' }),
    })
    render(<PlanDetailPage />)
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /analyz/i })
      expect(btn).toBeDisabled()
    })
  })

  it('shows "Analysis pending" when no analysis exists', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...MOCK_PLAN, analysis: null, flywheel_score: 3 }),
    })
    render(<PlanDetailPage />)
    await waitFor(() =>
      expect(screen.getByText(/no analysis needed|analysis pending/i)).toBeInTheDocument()
    )
  })
})
