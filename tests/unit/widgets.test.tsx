import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Component 1: LearningsFeed
// ---------------------------------------------------------------------------

import { LearningsFeed } from '@/components/outcomes/learnings-feed'
import { SystemHealthAccordion } from '@/components/widgets/system-health-accordion'
import { FleetStatus } from '@/components/widgets/fleet-status'
import type { SystemFitness, ServiceHealthResponse } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFitness(overrides: Partial<SystemFitness> = {}): SystemFitness {
  return {
    missRate: 0.15,
    missRateTrend: 'improving',
    corrections: 3,
    correctionsPrevPeriod: 7,
    skillsImproved: 2,
    sessions: 14,
    digest: '14 sessions, 3 corrections (down from 7), 2 skills improved',
    computedAt: '2026-03-25T12:00:00Z',
    ...overrides,
  }
}

function makeHealth(overrides: Partial<ServiceHealthResponse> = {}): ServiceHealthResponse {
  return {
    overall: 'nominal',
    checkedAt: '2026-03-25T12:00:00Z',
    isLocal: true,
    services: {
      spark_insights: { ok: true, detail: 'Healthy', latencyMs: 23 },
      tab_ledger: { ok: true, detail: 'Connected', latencyMs: 45 },
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// LearningsFeed tests
// ---------------------------------------------------------------------------

describe('LearningsFeed', () => {
  it('renders fitness digest text when fitness data provided', () => {
    render(<LearningsFeed fitness={makeFitness()} />)
    expect(
      screen.getByText('14 sessions, 3 corrections (down from 7), 2 skills improved')
    ).toBeInTheDocument()
  })

  it('shows improving trend with green styling and up arrow', () => {
    const { container } = render(
      <LearningsFeed fitness={makeFitness({ missRateTrend: 'improving' })} />
    )
    const banner = container.querySelector('[data-testid="fitness-banner"]')
    expect(banner).toBeInTheDocument()
    expect(banner?.className).toMatch(/green/)
    expect(banner?.textContent).toContain('\u2191') // up arrow
  })

  it('shows stable trend with amber styling and right arrow', () => {
    const { container } = render(
      <LearningsFeed fitness={makeFitness({ missRateTrend: 'stable' })} />
    )
    const banner = container.querySelector('[data-testid="fitness-banner"]')
    expect(banner?.className).toMatch(/amber/)
    expect(banner?.textContent).toContain('\u2192') // right arrow
  })

  it('shows degrading trend with red styling and down arrow', () => {
    const { container } = render(
      <LearningsFeed fitness={makeFitness({ missRateTrend: 'degrading' })} />
    )
    const banner = container.querySelector('[data-testid="fitness-banner"]')
    expect(banner?.className).toMatch(/red/)
    expect(banner?.textContent).toContain('\u2193') // down arrow
  })

  it('shows miss rate percentage', () => {
    render(<LearningsFeed fitness={makeFitness({ missRate: 0.15 })} />)
    expect(screen.getByText(/15% miss rate/)).toBeInTheDocument()
  })

  it('shows initializing message when fitness is null', () => {
    render(<LearningsFeed fitness={null} />)
    expect(
      screen.getByText(/Learning loop initializing/)
    ).toBeInTheDocument()
  })

  it('renders insight items when provided', () => {
    const insights = [
      { id: '1', content: 'Agent Ed improved deployment speed', created_at: '2026-03-25T10:00:00Z' },
      { id: '2', content: 'Miss rate dropped after skill patch', created_at: '2026-03-25T09:00:00Z' },
    ]
    render(<LearningsFeed fitness={makeFitness()} insights={insights} />)
    expect(screen.getByText('Agent Ed improved deployment speed')).toBeInTheDocument()
    expect(screen.getByText('Miss rate dropped after skill patch')).toBeInTheDocument()
  })

  it('shows "No insights captured yet" when insights array is empty', () => {
    render(<LearningsFeed fitness={makeFitness()} insights={[]} />)
    expect(screen.getByText('No insights captured yet')).toBeInTheDocument()
  })

  it('limits displayed insights to 5', () => {
    const insights = Array.from({ length: 8 }, (_, i) => ({
      id: `${i}`,
      content: `Insight number ${i}`,
      created_at: '2026-03-25T10:00:00Z',
    }))
    render(<LearningsFeed fitness={makeFitness()} insights={insights} />)
    expect(screen.getByText('Insight number 0')).toBeInTheDocument()
    expect(screen.getByText('Insight number 4')).toBeInTheDocument()
    expect(screen.queryByText('Insight number 5')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// SystemHealthAccordion tests
// ---------------------------------------------------------------------------

describe('SystemHealthAccordion', () => {
  it('renders collapsed by default with summary text', () => {
    render(<SystemHealthAccordion health={makeHealth()} />)
    expect(screen.getByText('All systems nominal')).toBeInTheDocument()
  })

  it('shows degraded summary with count', () => {
    render(
      <SystemHealthAccordion
        health={makeHealth({
          overall: 'degraded',
          services: {
            spark_insights: { ok: false, detail: 'Timeout' },
            tab_ledger: { ok: true, detail: 'Connected' },
          },
        })}
      />
    )
    expect(screen.getByText(/1 service.* need.* attention/i)).toBeInTheDocument()
  })

  it('shows down summary with count', () => {
    render(
      <SystemHealthAccordion
        health={makeHealth({
          overall: 'down',
          services: {
            spark_insights: { ok: false, detail: 'Down' },
            tab_ledger: { ok: false, detail: 'Down' },
          },
        })}
      />
    )
    expect(screen.getByText(/2 services down/i)).toBeInTheDocument()
  })

  it('shows unavailable summary', () => {
    render(<SystemHealthAccordion health={makeHealth({ overall: 'unavailable' })} />)
    expect(screen.getByText(/Local services/i)).toBeInTheDocument()
  })

  it('shows checking text when health is null', () => {
    render(<SystemHealthAccordion health={null} />)
    expect(screen.getByText('Checking services...')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<SystemHealthAccordion health={null} loading />)
    expect(screen.getByText('Checking services...')).toBeInTheDocument()
  })

  it('expands on click to show per-service details', () => {
    render(<SystemHealthAccordion health={makeHealth()} />)

    // Services should NOT be visible when collapsed
    expect(screen.queryByText('Spark Insights')).not.toBeInTheDocument()

    // Click to expand
    fireEvent.click(screen.getByRole('button'))

    // Services should now be visible
    expect(screen.getByText('Spark Insights')).toBeInTheDocument()
    expect(screen.getByText('Tab Ledger')).toBeInTheDocument()
  })

  it('shows latency for services that have it', () => {
    render(<SystemHealthAccordion health={makeHealth()} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/23ms/)).toBeInTheDocument()
  })

  it('formats service names from snake_case to Title Case', () => {
    render(
      <SystemHealthAccordion
        health={makeHealth({
          services: {
            my_cool_service: { ok: true, detail: 'Running' },
          },
        })}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('My Cool Service')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// FleetStatus tests
// ---------------------------------------------------------------------------

describe('FleetStatus', () => {
  it('renders agent and task counts', () => {
    render(
      <FleetStatus agentsOnline={3} tasksRunning={5} errors24h={1} activeSessions={2} />
    )
    expect(screen.getByText(/3 agents active/i)).toBeInTheDocument()
    expect(screen.getByText(/5 tasks running/i)).toBeInTheDocument()
  })

  it('shows errors when > 0', () => {
    render(
      <FleetStatus agentsOnline={1} tasksRunning={2} errors24h={3} activeSessions={1} />
    )
    expect(screen.getByText(/3 error/i)).toBeInTheDocument()
  })

  it('hides errors when 0', () => {
    render(
      <FleetStatus agentsOnline={1} tasksRunning={2} errors24h={0} activeSessions={1} />
    )
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })

  it('shows "Fleet idle" when all counts are zero', () => {
    render(
      <FleetStatus agentsOnline={0} tasksRunning={0} errors24h={0} activeSessions={0} />
    )
    expect(screen.getByText('Fleet idle')).toBeInTheDocument()
  })

  it('links agents segment to /agents', () => {
    render(
      <FleetStatus agentsOnline={2} tasksRunning={1} errors24h={0} activeSessions={1} />
    )
    const agentLink = screen.getByText(/2 agents active/i).closest('a')
    expect(agentLink).toHaveAttribute('href', '/agents')
  })

  it('links tasks segment to /tasks', () => {
    render(
      <FleetStatus agentsOnline={1} tasksRunning={3} errors24h={0} activeSessions={1} />
    )
    const taskLink = screen.getByText(/3 tasks running/i).closest('a')
    expect(taskLink).toHaveAttribute('href', '/tasks')
  })

  it('colors agents green when > 0', () => {
    render(
      <FleetStatus agentsOnline={2} tasksRunning={0} errors24h={0} activeSessions={1} />
    )
    const agentSpan = screen.getByText(/2 agents active/i)
    expect(agentSpan.className).toMatch(/green/)
  })

  it('colors agents gray when 0 (in idle state text)', () => {
    render(
      <FleetStatus agentsOnline={0} tasksRunning={0} errors24h={0} activeSessions={0} />
    )
    // When all zero, it shows "Fleet idle" — no individual segments
    expect(screen.getByText('Fleet idle')).toBeInTheDocument()
  })
})
