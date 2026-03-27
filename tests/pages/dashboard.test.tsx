import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before imports
// ---------------------------------------------------------------------------
const { mockGetDashboardCounts, mockGetRecentSessions, mockGetRecentLogs,
  mockGetOutcomeCounts, mockSupabase } = vi.hoisted(() => ({
  mockGetDashboardCounts: vi.fn(),
  mockGetRecentSessions: vi.fn(),
  mockGetRecentLogs: vi.fn(),
  mockGetOutcomeCounts: vi.fn(),
  mockSupabase: { from: vi.fn() },
}))

vi.mock('@/lib/queries', () => ({
  getDashboardCounts: mockGetDashboardCounts,
  getRecentSessions: mockGetRecentSessions,
  getRecentLogs: mockGetRecentLogs,
  getOutcomeCounts: mockGetOutcomeCounts,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-testid="next-link" {...props}>{children}</a>
  ),
}))

// Mock child components to isolate dashboard structure tests
vi.mock('@/components/sidebar-nav', () => ({
  SidebarNav: () => <nav data-testid="sidebar-nav">SidebarNav</nav>,
}))

vi.mock('@/components/event-rail', () => ({
  EventRail: () => <aside data-testid="event-rail">EventRail</aside>,
}))

vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">ThemeToggle</button>,
}))

vi.mock('@/components/stealth-card', () => ({
  StealthCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="stealth-card" className={className}>{children}</div>
  ),
}))

vi.mock('@/components/outcomes', () => ({
  ResearchCard: ({ data }: { data: unknown }) => <div data-testid="research-card">{data ? 'research-loaded' : 'research-null'}</div>,
  AeonCard: ({ data }: { data: unknown }) => <div data-testid="aeon-card">{data ? 'aeon-loaded' : 'aeon-null'}</div>,
  OpsecCard: ({ data }: { data: unknown }) => <div data-testid="opsec-card">{data ? 'opsec-loaded' : 'opsec-null'}</div>,
  MessagesCard: ({ data, unreadCount }: { data: unknown; unreadCount?: number }) => <div data-testid="messages-card">{data ? 'messages-loaded' : 'messages-null'}{unreadCount ? ` unread-${unreadCount}` : ''}</div>,
}))

vi.mock('@/components/outcomes/learnings-feed', () => ({
  LearningsFeed: ({ fitness, insights }: { fitness: unknown; insights?: unknown[] }) => (
    <div data-testid="learnings-feed">
      {fitness ? 'fitness-loaded' : 'fitness-null'}
      {insights && insights.length > 0 ? ` insights-${insights.length}` : ''}
    </div>
  ),
}))

vi.mock('@/components/widgets/fleet-status', () => ({
  FleetStatus: (props: { agentsOnline: number; tasksRunning: number; errors24h: number; activeSessions: number }) => (
    <div data-testid="fleet-status">
      agents={props.agentsOnline} tasks={props.tasksRunning} errors={props.errors24h} sessions={props.activeSessions}
    </div>
  ),
}))

vi.mock('@/components/widgets/system-health-accordion', () => ({
  SystemHealthAccordion: ({ health }: { health: unknown }) => (
    <div data-testid="system-health-accordion">{health ? 'health-loaded' : 'health-null'}</div>
  ),
}))

// Mock fetch for engine-status + local API calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Default mock return values
// ---------------------------------------------------------------------------
const defaultCounts = { activeSessions: 2, agentsOnline: 3, tasksRunning: 5, errors24h: 0 }
const defaultOutcomes = {
  research: { category: 'research', headline: 'Research pipeline initializing', detail: null, count: 0, items: [] },
  aeon: { category: 'aeon', headline: '2 proposals', detail: null, count: 2, items: [] },
  opsec: { category: 'opsec', headline: '0 errors (24h)', detail: null, count: 0, items: [] },
  messages: { category: 'messages', headline: '3 recent', detail: null, count: 3, items: [] },
}
const defaultEngine = {
  health: 'nominal',
  avgCycleMs: 12000,
  wins: [],
  failures: [],
  stalledObjectives: [],
  authority: { enabled: true, domains: {} },
}

beforeEach(() => {
  vi.clearAllMocks()

  mockGetDashboardCounts.mockResolvedValue(defaultCounts)
  mockGetRecentSessions.mockResolvedValue([])
  mockGetRecentLogs.mockResolvedValue([])
  mockGetOutcomeCounts.mockResolvedValue(defaultOutcomes)

  mockFetch.mockImplementation((url: string) => {
    if (url === '/api/engine-status') {
      return Promise.resolve({ json: () => Promise.resolve(defaultEngine) })
    }
    if (url === '/api/services/health') {
      return Promise.resolve({ json: () => Promise.resolve({ overall: 'nominal', services: {} }) })
    }
    if (url === '/api/memory/status') {
      return Promise.resolve({ json: () => Promise.resolve({ fitness: null }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({}) })
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DashboardPage — outcome-first layout', () => {
  async function renderDashboard() {
    const mod = await import('@/app/dashboard/page')
    const DashboardPage = mod.default
    return render(<DashboardPage />)
  }

  // --- Structural presence of outcome cards ---
  it('renders all 4 outcome cards after data loads', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('research-card')).toBeInTheDocument()
    })
    expect(screen.getByTestId('aeon-card')).toBeInTheDocument()
    expect(screen.getByTestId('opsec-card')).toBeInTheDocument()
    expect(screen.getByTestId('messages-card')).toBeInTheDocument()
  })

  it('outcome cards show loaded state when data arrives', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('research-card')).toHaveTextContent('research-loaded')
    })
    expect(screen.getByTestId('aeon-card')).toHaveTextContent('aeon-loaded')
    expect(screen.getByTestId('opsec-card')).toHaveTextContent('opsec-loaded')
    expect(screen.getByTestId('messages-card')).toHaveTextContent('messages-loaded')
  })

  // --- Learnings feed ---
  it('renders the learnings feed', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('learnings-feed')).toBeInTheDocument()
    })
  })

  // --- Fleet status ---
  it('renders the fleet status bar with counts', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('fleet-status')).toBeInTheDocument()
    })
    expect(screen.getByTestId('fleet-status')).toHaveTextContent('agents=3')
    expect(screen.getByTestId('fleet-status')).toHaveTextContent('tasks=5')
    expect(screen.getByTestId('fleet-status')).toHaveTextContent('errors=0')
    expect(screen.getByTestId('fleet-status')).toHaveTextContent('sessions=2')
  })

  // --- System health accordion ---
  it('renders system health accordion', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('system-health-accordion')).toBeInTheDocument()
    })
  })

  // --- Preserved layout elements ---
  it('renders SidebarNav on the left', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-nav')).toBeInTheDocument()
    })
  })

  it('renders EventRail on the right', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('event-rail')).toBeInTheDocument()
    })
  })

  it('renders top bar with Engine Live indicator', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Engine Live')).toBeInTheDocument()
    })
  })

  it('renders top bar theme toggle', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
    })
  })

  // --- Old elements should NOT be present ---
  it('does NOT render StatCard links (replaced by outcome cards + fleet status)', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('research-card')).toBeInTheDocument()
    })
    // Old stat card labels
    expect(screen.queryByText('Active Sessions')).not.toBeInTheDocument()
    expect(screen.queryByText('Agents Online')).not.toBeInTheDocument()
    expect(screen.queryByText('Tasks Running')).not.toBeInTheDocument()
    expect(screen.queryByText('Errors (24h)')).not.toBeInTheDocument()
  })

  it('does NOT render the old 3-column panels (System Health, Engine Status, Authority)', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('research-card')).toBeInTheDocument()
    })
    // The old panel headers
    expect(screen.queryByText('System Health')).not.toBeInTheDocument()
    expect(screen.queryByText('Engine Status')).not.toBeInTheDocument()
    expect(screen.queryByText('Authority')).not.toBeInTheDocument()
  })

  it('does NOT render old Recent Sessions / Recent Logs panels', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('research-card')).toBeInTheDocument()
    })
    expect(screen.queryByText('Recent Sessions')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent Logs')).not.toBeInTheDocument()
  })

  // --- ConnectPrompt fallback ---
  it('shows ConnectPrompt when supabase is null', async () => {
    // Temporarily override supabase mock — must resetModules before AND after
    vi.resetModules()
    vi.doMock('@/lib/supabase', () => ({ supabase: null }))
    const mod = await import('@/app/dashboard/page')
    const DashboardPage = mod.default
    render(<DashboardPage />)
    expect(screen.getByText(/connect supabase/i)).toBeInTheDocument()
    // Restore for subsequent tests
    vi.resetModules()
    vi.doMock('@/lib/supabase', () => ({ supabase: mockSupabase }))
  })

  // --- getOutcomeCounts is called ---
  it('calls getOutcomeCounts during data fetch', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(mockGetOutcomeCounts).toHaveBeenCalledTimes(1)
    })
  })

  // --- Graceful fallback when local APIs fail ---
  it('renders health accordion with null when local APIs fail', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/engine-status') {
        return Promise.resolve({ json: () => Promise.resolve(defaultEngine) })
      }
      // Local APIs fail
      if (url === '/api/services/health' || url === '/api/memory/status') {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve({ json: () => Promise.resolve({}) })
    })

    // Fresh import to avoid module cache issues from ConnectPrompt test
    vi.resetModules()
    vi.doMock('@/lib/supabase', () => ({ supabase: mockSupabase }))
    const mod = await import('@/app/dashboard/page')
    const DashboardPage = mod.default
    render(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getByTestId('system-health-accordion')).toHaveTextContent('health-null')
    })
  })
})
