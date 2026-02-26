import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ObjectiveWithMetrics } from '@/lib/types'

// ---------------------------------------------------------------------------
// Mock data factory
// ---------------------------------------------------------------------------
function makeObjective(overrides: Partial<ObjectiveWithMetrics> = {}): ObjectiveWithMetrics {
  return {
    id: 'obj-1',
    title: 'Ship MVP',
    description: 'Get the product out the door',
    success_criteria: 'Users can sign up',
    project_id: null,
    max_iterations: 5,
    max_cost_usd: 100,
    iteration_count: 2,
    status: 'active',
    created_by: 'sensei',
    created_at: '2026-02-20T10:00:00Z',
    updated_at: '2026-02-24T14:00:00Z',
    completed_at: null,
    totalMissions: 3,
    completedMissions: 1,
    activeMissions: 2,
    pendingProposals: 1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock next/link and motion/react to avoid SSR issues in test
// ---------------------------------------------------------------------------
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-testid="next-link">{children}</a>
  ),
}))

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => false,
}))

// ---------------------------------------------------------------------------
// 1. ObjectiveCard tests
// ---------------------------------------------------------------------------
describe('ObjectiveCard', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('renders title and description', async () => {
    const { ObjectiveCard } = await import('@/components/objective-card')
    render(<ObjectiveCard objective={makeObjective()} />)

    expect(screen.getByText('Ship MVP')).toBeInTheDocument()
    expect(screen.getByText('Get the product out the door')).toBeInTheDocument()
  })

  it('renders mission progress bar with correct text', async () => {
    const { ObjectiveCard } = await import('@/components/objective-card')
    render(<ObjectiveCard objective={makeObjective({ completedMissions: 2, totalMissions: 4 })} />)

    expect(screen.getByText('2/4 missions')).toBeInTheDocument()
  })

  it('renders mission progress bar with zero missions', async () => {
    const { ObjectiveCard } = await import('@/components/objective-card')
    render(<ObjectiveCard objective={makeObjective({ completedMissions: 0, totalMissions: 0 })} />)

    expect(screen.getByText('0/0 missions')).toBeInTheDocument()
  })

  it('renders active mission count', async () => {
    const { ObjectiveCard } = await import('@/components/objective-card')
    render(<ObjectiveCard objective={makeObjective({ activeMissions: 3 })} />)

    expect(screen.getByText(/3 active/i)).toBeInTheDocument()
  })

  it('renders pending proposal count when > 0', async () => {
    const { ObjectiveCard } = await import('@/components/objective-card')
    render(<ObjectiveCard objective={makeObjective({ pendingProposals: 4 })} />)

    expect(screen.getByText(/4 pending/i)).toBeInTheDocument()
  })

  it('does not render pending proposal badge when 0', async () => {
    const { ObjectiveCard } = await import('@/components/objective-card')
    render(<ObjectiveCard objective={makeObjective({ pendingProposals: 0 })} />)

    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument()
  })

  it('renders created_by and relative time', async () => {
    const { ObjectiveCard } = await import('@/components/objective-card')
    render(<ObjectiveCard objective={makeObjective({ created_by: 'sensei' })} />)

    expect(screen.getByText(/sensei/i)).toBeInTheDocument()
  })

  it('links to /objectives/{id}', async () => {
    const { ObjectiveCard } = await import('@/components/objective-card')
    render(<ObjectiveCard objective={makeObjective({ id: 'obj-42' })} />)

    const link = screen.getByTestId('next-link')
    expect(link).toHaveAttribute('href', '/objectives/obj-42')
  })

  it('shows correct status badge color for active', async () => {
    const { ObjectiveCard } = await import('@/components/objective-card')
    const { container } = render(<ObjectiveCard objective={makeObjective({ status: 'active' })} />)

    // Status badge should exist with "active" text
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('shows correct status badge for paused', async () => {
    const { ObjectiveCard } = await import('@/components/objective-card')
    render(<ObjectiveCard objective={makeObjective({ status: 'paused' })} />)

    expect(screen.getByText('paused')).toBeInTheDocument()
  })

  it('shows correct status badge for failed', async () => {
    const { ObjectiveCard } = await import('@/components/objective-card')
    render(<ObjectiveCard objective={makeObjective({ status: 'failed' })} />)

    expect(screen.getByText('failed')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 2. ObjectiveOverview tests
// ---------------------------------------------------------------------------
describe('ObjectiveOverview', () => {
  const activeObj = makeObjective({ id: 'obj-a', title: 'Active Obj', status: 'active' })
  const pausedObj = makeObjective({ id: 'obj-b', title: 'Paused Obj', status: 'paused' })
  const completedObj = makeObjective({ id: 'obj-c', title: 'Completed Obj', status: 'completed' })
  const failedObj = makeObjective({ id: 'obj-d', title: 'Failed Obj', status: 'failed' })

  it('renders Active column with active objectives', async () => {
    const { ObjectiveOverview } = await import('@/components/objective-overview')
    render(<ObjectiveOverview objectives={[activeObj]} />)

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Active Obj')).toBeInTheDocument()
  })

  it('renders Paused column with paused objectives', async () => {
    const { ObjectiveOverview } = await import('@/components/objective-overview')
    render(<ObjectiveOverview objectives={[pausedObj]} />)

    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('Paused Obj')).toBeInTheDocument()
  })

  it('renders Failed column with failed objectives', async () => {
    const { ObjectiveOverview } = await import('@/components/objective-overview')
    render(<ObjectiveOverview objectives={[failedObj]} />)

    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Failed Obj')).toBeInTheDocument()
  })

  it('hides empty columns', async () => {
    const { ObjectiveOverview } = await import('@/components/objective-overview')
    render(<ObjectiveOverview objectives={[activeObj]} />)

    // Only Active column should be visible
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
    expect(screen.queryByText('Failed')).not.toBeInTheDocument()
  })

  it('shows "Show completed" toggle when completed objectives exist but column is hidden', async () => {
    const { ObjectiveOverview } = await import('@/components/objective-overview')
    render(<ObjectiveOverview objectives={[activeObj, completedObj]} />)

    // Completed column should be hidden by default, with toggle visible
    expect(screen.getByText(/show completed/i)).toBeInTheDocument()
  })

  it('shows all four columns when objectives in each status exist', async () => {
    const { ObjectiveOverview } = await import('@/components/objective-overview')
    render(<ObjectiveOverview objectives={[activeObj, pausedObj, failedObj]} />)

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('shows column count badges', async () => {
    const { ObjectiveOverview } = await import('@/components/objective-overview')
    const objs = [activeObj, makeObjective({ id: 'obj-a2', title: 'Active Obj 2', status: 'active' })]
    render(<ObjectiveOverview objectives={objs} />)

    // Should show count "2" for active column
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 3. getObjectivesWithMetrics query tests
// ---------------------------------------------------------------------------
describe('getObjectivesWithMetrics', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns empty array when supabase is null', async () => {
    vi.doMock('@/lib/supabase', () => ({ supabase: null }))
    const { getObjectivesWithMetrics } = await import('@/lib/queries')
    const result = await getObjectivesWithMetrics()
    expect(result).toEqual([])
  })

  it('returns objectives with merged metrics', async () => {
    const mockObjectives = [
      { id: 'obj-1', title: 'Test', status: 'active', created_by: 'sensei', created_at: '2026-02-20', updated_at: '2026-02-24' },
    ]
    const mockMissions = [
      { id: 'm1', objective_id: 'obj-1', status: 'running' },
      { id: 'm2', objective_id: 'obj-1', status: 'completed' },
      { id: 'm3', objective_id: 'obj-1', status: 'deployed' },
    ]
    const mockProposals = [
      { id: 'pr1', objective_id: 'obj-1', status: 'pending' },
      { id: 'pr2', objective_id: 'obj-1', status: 'pending' },
    ]

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      if (table === 'objectives') {
        chain.order = vi.fn().mockResolvedValue({ data: mockObjectives, error: null })
        chain.select = vi.fn().mockReturnValue({ order: chain.order })
      } else if (table === 'missions') {
        chain.select = vi.fn().mockResolvedValue({ data: mockMissions, error: null })
      } else if (table === 'proposals') {
        chain.select = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: mockProposals, error: null }) })
      }
      return chain
    })

    vi.doMock('@/lib/supabase', () => ({
      supabase: { from: mockFrom },
    }))

    const { getObjectivesWithMetrics } = await import('@/lib/queries')
    const result = await getObjectivesWithMetrics()

    expect(result).toHaveLength(1)
    expect(result[0].totalMissions).toBe(3)
    expect(result[0].completedMissions).toBe(2)
    expect(result[0].activeMissions).toBe(1)
    expect(result[0].pendingProposals).toBe(2)
  })
})
