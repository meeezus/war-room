import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { OutcomeCard } from '@/lib/types'

// ---------------------------------------------------------------------------
// Mock next/link to render as plain <a> in tests
// ---------------------------------------------------------------------------
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-testid="next-link" {...props}>{children}</a>
  ),
}))

// ---------------------------------------------------------------------------
// Data factories
// ---------------------------------------------------------------------------
function makeCard(overrides: Partial<OutcomeCard> = {}): OutcomeCard {
  return {
    category: 'research',
    headline: '3 findings',
    detail: null,
    count: 3,
    items: [
      { title: 'Found new API pattern', timestamp: new Date().toISOString(), status: 'active' },
      { title: 'Research complete', timestamp: new Date().toISOString(), status: 'done' },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// ResearchCard
// ---------------------------------------------------------------------------
describe('ResearchCard', () => {
  it('renders the research icon and category name', async () => {
    const { ResearchCard } = await import('@/components/outcomes/research-card')
    render(<ResearchCard data={makeCard()} />)
    // Category label is exact "Research" in the header
    expect(screen.getAllByText(/research/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders the headline metric', async () => {
    const { ResearchCard } = await import('@/components/outcomes/research-card')
    render(<ResearchCard data={makeCard({ headline: '5 findings' })} />)
    expect(screen.getByText('5 findings')).toBeInTheDocument()
  })

  it('renders items list', async () => {
    const { ResearchCard } = await import('@/components/outcomes/research-card')
    render(<ResearchCard data={makeCard()} />)
    expect(screen.getByText('Found new API pattern')).toBeInTheDocument()
    expect(screen.getByText('Research complete')).toBeInTheDocument()
  })

  it('renders action button with correct href', async () => {
    const { ResearchCard } = await import('@/components/outcomes/research-card')
    render(<ResearchCard data={makeCard({ actionLabel: 'View', actionHref: '/research' })} />)
    const link = screen.getByText('View')
    expect(link.closest('a')).toHaveAttribute('href', '/research')
  })

  it('shows empty state when count is 0 and no items', async () => {
    const { ResearchCard } = await import('@/components/outcomes/research-card')
    render(<ResearchCard data={makeCard({ count: 0, headline: 'Research pipeline initializing', items: [] })} />)
    // Both headline and body contain "Research pipeline initializing" so use getAllByText
    expect(screen.getAllByText(/research pipeline initializing/i).length).toBeGreaterThanOrEqual(1)
    // The empty state body has the full descriptive text
    expect(screen.getByText(/findings will appear once scanning tools are wired/i)).toBeInTheDocument()
  })

  it('handles null data (loading state)', async () => {
    const { ResearchCard } = await import('@/components/outcomes/research-card')
    const { container } = render(<ResearchCard data={null} />)
    // Should render without crashing — shows skeleton or placeholder
    expect(container.firstChild).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// AeonCard
// ---------------------------------------------------------------------------
describe('AeonCard', () => {
  it('renders the aeon icon and category name with AE ligature', async () => {
    const { AeonCard } = await import('@/components/outcomes/aeon-card')
    render(<AeonCard data={makeCard({ category: 'aeon', headline: '5 proposals' })} />)
    expect(screen.getByText(/\u00C6on/)).toBeInTheDocument()
  })

  it('renders headline', async () => {
    const { AeonCard } = await import('@/components/outcomes/aeon-card')
    render(<AeonCard data={makeCard({ category: 'aeon', headline: '5 proposals' })} />)
    expect(screen.getByText('5 proposals')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    const { AeonCard } = await import('@/components/outcomes/aeon-card')
    render(<AeonCard data={makeCard({ category: 'aeon', count: 0, headline: 'No proposals yet', items: [] })} />)
    expect(screen.getByText(/revenue pipeline/i)).toBeInTheDocument()
  })

  it('renders action link to objectives', async () => {
    const { AeonCard } = await import('@/components/outcomes/aeon-card')
    render(<AeonCard data={makeCard({ category: 'aeon', actionLabel: 'Review', actionHref: '/objectives' })} />)
    const link = screen.getByText('Review')
    expect(link.closest('a')).toHaveAttribute('href', '/objectives')
  })
})

// ---------------------------------------------------------------------------
// OpsecCard
// ---------------------------------------------------------------------------
describe('OpsecCard', () => {
  it('renders the opsec icon and category name', async () => {
    const { OpsecCard } = await import('@/components/outcomes/opsec-card')
    render(<OpsecCard data={makeCard({ category: 'opsec', headline: '0 errors (24h)', count: 0 })} />)
    expect(screen.getByText(/opsec/i)).toBeInTheDocument()
  })

  it('shows nominal empty state when count is 0', async () => {
    const { OpsecCard } = await import('@/components/outcomes/opsec-card')
    render(<OpsecCard data={makeCard({ category: 'opsec', count: 0, headline: '0 errors (24h)', items: [] })} />)
    expect(screen.getByText(/all systems nominal/i)).toBeInTheDocument()
  })

  it('uses red accent when errors exist', async () => {
    const { OpsecCard } = await import('@/components/outcomes/opsec-card')
    render(
      <OpsecCard data={makeCard({ category: 'opsec', count: 3, headline: '3 errors (24h)' })} />
    )
    // The headline element should have red color class
    const headline = screen.getByText('3 errors (24h)')
    expect(headline.className).toMatch(/text-red/)
  })

  it('uses amber accent when no errors', async () => {
    const { OpsecCard } = await import('@/components/outcomes/opsec-card')
    render(
      <OpsecCard data={makeCard({ category: 'opsec', count: 0, headline: '0 errors (24h)' })} />
    )
    const headline = screen.getByText('0 errors (24h)')
    expect(headline.className).toMatch(/text-amber/)
  })

  it('renders action link to discoveries', async () => {
    const { OpsecCard } = await import('@/components/outcomes/opsec-card')
    render(<OpsecCard data={makeCard({ category: 'opsec', actionLabel: 'View', actionHref: '/discoveries' })} />)
    const link = screen.getByText('View')
    expect(link.closest('a')).toHaveAttribute('href', '/discoveries')
  })
})

// ---------------------------------------------------------------------------
// MessagesCard
// ---------------------------------------------------------------------------
describe('MessagesCard', () => {
  it('renders the messages icon and category name', async () => {
    const { MessagesCard } = await import('@/components/outcomes/messages-card')
    render(<MessagesCard data={makeCard({ category: 'messages', headline: '3 recent' })} />)
    expect(screen.getByText(/messages/i)).toBeInTheDocument()
  })

  it('renders headline', async () => {
    const { MessagesCard } = await import('@/components/outcomes/messages-card')
    render(<MessagesCard data={makeCard({ category: 'messages', headline: '3 recent' })} />)
    expect(screen.getByText('3 recent')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    const { MessagesCard } = await import('@/components/outcomes/messages-card')
    render(<MessagesCard data={makeCard({ category: 'messages', count: 0, headline: 'No briefs yet', items: [] })} />)
    expect(screen.getByText(/morning briefs and notification/i)).toBeInTheDocument()
  })

  it('handles null data (loading state)', async () => {
    const { MessagesCard } = await import('@/components/outcomes/messages-card')
    const { container } = render(<MessagesCard data={null} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('shows unread badge when unreadCount > 0', async () => {
    const { MessagesCard } = await import('@/components/outcomes/messages-card')
    render(<MessagesCard data={makeCard({ category: 'messages', headline: '3 recent' })} unreadCount={5} />)
    expect(screen.getByText('5 unread')).toBeInTheDocument()
  })

  it('does not show unread badge when unreadCount is 0', async () => {
    const { MessagesCard } = await import('@/components/outcomes/messages-card')
    render(<MessagesCard data={makeCard({ category: 'messages', headline: '3 recent' })} unreadCount={0} />)
    expect(screen.queryByText(/unread/)).not.toBeInTheDocument()
  })

  it('does not show unread badge when unreadCount is undefined', async () => {
    const { MessagesCard } = await import('@/components/outcomes/messages-card')
    render(<MessagesCard data={makeCard({ category: 'messages', headline: '3 recent' })} />)
    expect(screen.queryByText(/unread/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Barrel export
// ---------------------------------------------------------------------------
describe('outcomes/index barrel', () => {
  it('exports all 4 card components', async () => {
    const barrel = await import('@/components/outcomes/index')
    expect(barrel.ResearchCard).toBeDefined()
    expect(barrel.AeonCard).toBeDefined()
    expect(barrel.OpsecCard).toBeDefined()
    expect(barrel.MessagesCard).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Relative time helper (tested via rendered output)
// ---------------------------------------------------------------------------
describe('relative time rendering', () => {
  it('renders a relative timestamp for items', async () => {
    const { ResearchCard } = await import('@/components/outcomes/research-card')
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    render(
      <ResearchCard
        data={makeCard({
          items: [{ title: 'Test item', timestamp: twoHoursAgo, status: 'active' }],
        })}
      />
    )
    expect(screen.getByText(/2h ago/)).toBeInTheDocument()
  })
})
