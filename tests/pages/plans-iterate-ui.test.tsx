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

vi.mock('@/lib/realtime', () => ({
  useRealtimePlanMissions: (_planId: string, initial: unknown[]) => initial,
}))

vi.mock('@/lib/queries', () => ({
  getPlanMissions: vi.fn().mockResolvedValue([]),
}))

import PlanDetailPage from '@/app/plans/[id]/page'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const MOCK_PLAN = {
  id: 'plan-abc',
  title: 'Deploy Notification System',
  raw_markdown: '# Notification System\n\n**Mode:** Builder\n\n## BEAD-001: Setup\nCreate notification service',
  parsed_beads: [
    {
      id: 'BEAD-001',
      title: 'Setup notification service',
      description: 'Create the base notification service',
      dependencies: [],
      blocks: [],
      size: 'M',
      accept: ['Service responds to health check'],
      files: ['lib/notifications.ts'],
      repo: 'war-room',
      domain: 'engineering',
      wave_index: 0,
    },
  ],
  analysis: {
    depth: 'quick',
    pushback: ['Consider rate limiting'],
    alternatives: [],
    blind_spots: [],
    recommendation: 'Proceed with caution',
    analyzed_at: new Date().toISOString(),
  },
  status: 'reviewing',
  flywheel_score: 6,
  score_breakdown: { money: 2, blast_radius: 2, novelty: 2 },
  auto_run: false,
  wave_count: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Tests: Iterate UI
// ---------------------------------------------------------------------------
describe('PlanDetailPage — Iterate UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ plan: MOCK_PLAN }),
    })
  })

  it('shows Iterate button when plan is in reviewing status', async () => {
    render(<PlanDetailPage />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /iterate/i })).toBeInTheDocument()
    )
  })

  it('does not show feedback textarea by default', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => screen.getByRole('button', { name: /iterate/i }))
    expect(screen.queryByPlaceholderText(/feedback/i)).not.toBeInTheDocument()
  })

  it('expands feedback textarea when Iterate button is clicked', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => screen.getByRole('button', { name: /iterate/i }))

    fireEvent.click(screen.getByRole('button', { name: /iterate/i }))
    expect(screen.getByPlaceholderText(/feedback/i)).toBeInTheDocument()
  })

  it('shows Submit Feedback and Cancel buttons in expanded state', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => screen.getByRole('button', { name: /iterate/i }))

    fireEvent.click(screen.getByRole('button', { name: /iterate/i }))
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('disables Submit Feedback when textarea is empty', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => screen.getByRole('button', { name: /iterate/i }))

    fireEvent.click(screen.getByRole('button', { name: /iterate/i }))
    const submitBtn = screen.getByRole('button', { name: /submit feedback/i })
    expect(submitBtn).toBeDisabled()
  })

  it('enables Submit Feedback when textarea has content', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => screen.getByRole('button', { name: /iterate/i }))

    fireEvent.click(screen.getByRole('button', { name: /iterate/i }))
    const textarea = screen.getByPlaceholderText(/feedback/i)
    fireEvent.change(textarea, { target: { value: 'Add more beads' } })

    const submitBtn = screen.getByRole('button', { name: /submit feedback/i })
    expect(submitBtn).not.toBeDisabled()
  })

  it('collapses feedback area when Cancel is clicked', async () => {
    render(<PlanDetailPage />)
    await waitFor(() => screen.getByRole('button', { name: /iterate/i }))

    fireEvent.click(screen.getByRole('button', { name: /iterate/i }))
    expect(screen.getByPlaceholderText(/feedback/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText(/feedback/i)).not.toBeInTheDocument()
  })

  it('calls /api/plans/[id]/iterate on submit', async () => {
    // Initial fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ plan: MOCK_PLAN }),
    })

    render(<PlanDetailPage />)
    await waitFor(() => screen.getByRole('button', { name: /iterate/i }))

    fireEvent.click(screen.getByRole('button', { name: /iterate/i }))
    const textarea = screen.getByPlaceholderText(/feedback/i)
    fireEvent.change(textarea, { target: { value: 'Add auth bead' } })

    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    await waitFor(() => {
      const iterateCall = mockFetch.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/iterate')
      )
      expect(iterateCall).toBeTruthy()
      expect(iterateCall![1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: 'Add auth bead' }),
        })
      )
    })
  })

  it('hides Iterate button when plan is running', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ plan: { ...MOCK_PLAN, status: 'running' } }),
    })
    render(<PlanDetailPage />)
    await waitFor(() => screen.getByText(/what this achieves/i))
    expect(screen.queryByRole('button', { name: /^iterate$/i })).not.toBeInTheDocument()
  })

  it('hides Iterate button when plan is completed', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ plan: { ...MOCK_PLAN, status: 'completed' } }),
    })
    render(<PlanDetailPage />)
    await waitFor(() => screen.getByText(/what this achieves/i))
    expect(screen.queryByRole('button', { name: /^iterate$/i })).not.toBeInTheDocument()
  })
})
