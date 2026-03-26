import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/stealth-card', () => ({
  StealthCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="stealth-card" className={className}>{children}</div>
  ),
}))

import { PlanWaveGraph } from '@/components/plan-wave-graph'
import type { ParsedBead } from '@/lib/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const BEADS: ParsedBead[] = [
  {
    id: 'BEAD-001',
    title: 'Setup database schema',
    description: 'Create tables for plans',
    dependencies: [],
    blocks: ['BEAD-002', 'BEAD-003'],
    size: 'S',
    accept: ['Migration runs'],
    files: ['migrations/001.sql'],
    repo: 'war-room',
    domain: 'engineering',
    wave_index: 0,
  },
  {
    id: 'BEAD-002',
    title: 'Build API routes',
    description: 'REST endpoints',
    dependencies: ['BEAD-001'],
    blocks: ['BEAD-004'],
    size: 'M',
    accept: ['Endpoints respond 200'],
    files: ['app/api/plans/route.ts'],
    repo: 'war-room',
    domain: 'engineering',
    wave_index: 1,
  },
  {
    id: 'BEAD-003',
    title: 'Parser module',
    description: 'Parse markdown plans',
    dependencies: ['BEAD-001'],
    blocks: ['BEAD-004'],
    size: 'M',
    accept: ['Parses correctly'],
    files: ['lib/plan-parser.ts'],
    repo: 'war-room',
    domain: 'engineering',
    wave_index: 1,
  },
  {
    id: 'BEAD-004',
    title: 'UI pages',
    description: 'List and detail pages',
    dependencies: ['BEAD-002', 'BEAD-003'],
    blocks: [],
    size: 'L',
    accept: ['Pages render'],
    files: ['app/plans/page.tsx'],
    repo: 'war-room',
    domain: 'product',
    wave_index: 2,
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PlanWaveGraph', () => {
  it('renders wave column labels', () => {
    render(<PlanWaveGraph beads={BEADS} />)
    expect(screen.getByText('Wave 0')).toBeInTheDocument()
    expect(screen.getByText('Wave 1')).toBeInTheDocument()
    expect(screen.getByText('Wave 2')).toBeInTheDocument()
  })

  it('renders bead titles', () => {
    render(<PlanWaveGraph beads={BEADS} />)
    expect(screen.getByText('Setup database schema')).toBeInTheDocument()
    expect(screen.getByText('Build API routes')).toBeInTheDocument()
    expect(screen.getByText('Parser module')).toBeInTheDocument()
    expect(screen.getByText('UI pages')).toBeInTheDocument()
  })

  it('groups beads by wave_index', () => {
    const { container } = render(<PlanWaveGraph beads={BEADS} />)
    // Wave 0: 1 bead, Wave 1: 2 beads, Wave 2: 1 bead
    const columns = container.querySelectorAll('[data-wave]')
    expect(columns).toHaveLength(3)
  })

  it('renders repo badges', () => {
    render(<PlanWaveGraph beads={BEADS} />)
    const repoBadges = screen.getAllByText('war-room')
    expect(repoBadges.length).toBe(4)
  })

  it('renders size badges', () => {
    render(<PlanWaveGraph beads={BEADS} />)
    expect(screen.getAllByText('S').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('M').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('L').length).toBeGreaterThanOrEqual(1)
  })

  it('renders domain badges', () => {
    render(<PlanWaveGraph beads={BEADS} />)
    expect(screen.getAllByText('engineering').length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText('product').length).toBeGreaterThanOrEqual(1)
  })

  it('renders arrow indicators between waves', () => {
    const { container } = render(<PlanWaveGraph beads={BEADS} />)
    // Should have arrows between wave columns (3 waves = 2 arrows)
    const arrows = container.querySelectorAll('[data-wave-arrow]')
    expect(arrows).toHaveLength(2)
  })

  it('renders status dots based on missionStatuses', () => {
    const statuses = {
      'BEAD-001': 'completed',
      'BEAD-002': 'running',
      'BEAD-003': 'queued',
    }
    const { container } = render(
      <PlanWaveGraph beads={BEADS} missionStatuses={statuses} />
    )
    // Check for status dot elements
    const dots = container.querySelectorAll('[data-status-dot]')
    expect(dots.length).toBe(4) // one per bead
  })

  it('shows gray dot for beads with no mission status', () => {
    const { container } = render(<PlanWaveGraph beads={BEADS} />)
    const dots = container.querySelectorAll('[data-status-dot]')
    // All should be gray/pending when no missionStatuses provided
    dots.forEach(dot => {
      expect(dot.className).toContain('bg-gray') // or neutral color
    })
  })

  it('renders empty state when no beads', () => {
    render(<PlanWaveGraph beads={[]} />)
    expect(screen.getByText(/no beads/i)).toBeInTheDocument()
  })

  it('handles single-wave plans', () => {
    const singleWave = [BEADS[0]]
    render(<PlanWaveGraph beads={singleWave} />)
    expect(screen.getByText('Wave 0')).toBeInTheDocument()
    expect(screen.getByText('Setup database schema')).toBeInTheDocument()
    // No arrows for single wave
    const { container } = render(<PlanWaveGraph beads={singleWave} />)
    const arrows = container.querySelectorAll('[data-wave-arrow]')
    expect(arrows).toHaveLength(0)
  })
})
