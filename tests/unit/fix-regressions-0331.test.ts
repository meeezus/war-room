import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock — hoisted before module imports
// ---------------------------------------------------------------------------
const { mockFrom, mockSelect, mockIn, mockEq, mockOrder, mockLimit, mockGte, mockNot } = vi.hoisted(() => {
  const mockNot = vi.fn()
  const mockGte = vi.fn()
  const mockLimit = vi.fn()
  const mockOrder = vi.fn()
  const mockIn = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const mockFrom = vi.fn()

  // Default chain — everything resolves to empty
  mockLimit.mockResolvedValue({ data: [], error: null, count: 0 })
  mockOrder.mockReturnValue({ limit: mockLimit })
  mockGte.mockResolvedValue({ data: [], error: null, count: 0 })
  mockNot.mockReturnValue({ order: mockOrder, eq: mockEq, in: mockIn, gte: mockGte })
  mockEq.mockReturnValue({ gte: mockGte, order: mockOrder, in: mockIn, not: mockNot })
  mockIn.mockReturnValue({ order: mockOrder, eq: mockEq, gte: mockGte, not: mockNot })
  mockSelect.mockReturnValue({ in: mockIn, eq: mockEq, order: mockOrder, not: mockNot })
  mockFrom.mockReturnValue({ select: mockSelect })

  return { mockFrom, mockSelect, mockIn, mockEq, mockOrder, mockLimit, mockGte, mockNot }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

import { getOutcomeCounts } from '@/lib/queries'

// ---------------------------------------------------------------------------
// Helper: reset all mocks to default chain
// ---------------------------------------------------------------------------
function resetMockChain() {
  vi.clearAllMocks()
  mockLimit.mockResolvedValue({ data: [], error: null, count: 0 })
  mockOrder.mockReturnValue({ limit: mockLimit })
  mockGte.mockResolvedValue({ data: [], error: null, count: 0 })
  mockNot.mockReturnValue({ order: mockOrder, eq: mockEq, in: mockIn, gte: mockGte })
  mockEq.mockReturnValue({ gte: mockGte, order: mockOrder, in: mockIn, not: mockNot })
  mockIn.mockReturnValue({ order: mockOrder, eq: mockEq, gte: mockGte, not: mockNot })
  mockSelect.mockReturnValue({ in: mockIn, eq: mockEq, order: mockOrder, not: mockNot })
  mockFrom.mockReturnValue({ select: mockSelect })
}

// ---------------------------------------------------------------------------
// Regression 1: Messages card should have an actionHref
// ---------------------------------------------------------------------------
describe('Messages card — has actionHref', () => {
  beforeEach(resetMockChain)

  it('messages card has actionLabel and actionHref when there are messages', async () => {
    // With messages present, the card should be clickable
    const result = await getOutcomeCounts()
    // Even with 0 messages, we want the card to be actionable
    expect(result.messages.actionLabel).toBe('View All')
    expect(result.messages.actionHref).toBe('/events')
  })
})

// ---------------------------------------------------------------------------
// Regression 2: Stealth card has stealth-shimmer class
// ---------------------------------------------------------------------------
describe('StealthCard — shimmer class', () => {
  it('stealth-card.tsx includes stealth-shimmer class on hover variant', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, '../../components/stealth-card.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('stealth-shimmer')
  })

  it('stealth-card.tsx includes overflow-hidden for shimmer containment', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, '../../components/stealth-card.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('overflow-hidden')
  })
})

// ---------------------------------------------------------------------------
// Regression 3: globals.css has shimmer keyframes
// ---------------------------------------------------------------------------
describe('globals.css — shimmer animation', () => {
  it('globals.css includes @keyframes shimmer', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, '../../app/globals.css')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('@keyframes shimmer')
  })

  it('globals.css includes .stealth-shimmer::after pseudo-element', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, '../../app/globals.css')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('.stealth-shimmer::after')
  })

  it('globals.css includes prefers-reduced-motion media query', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, '../../app/globals.css')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('prefers-reduced-motion')
  })
})

// ---------------------------------------------------------------------------
// Regression 4: Sidebar collapse functionality
// ---------------------------------------------------------------------------
describe('Sidebar nav — collapse feature', () => {
  it('sidebar-nav.tsx uses tenshu-sidebar-collapsed localStorage key', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, '../../components/sidebar-nav.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('tenshu-sidebar-collapsed')
  })

  it('sidebar-nav.tsx has collapse toggle button with chevrons', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, '../../components/sidebar-nav.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    // Unicode « and » characters (stored as escape sequences in source)
    expect(content).toContain('\\u00BB')
    expect(content).toContain('\\u00AB')
  })

  it('sidebar-nav.tsx includes ThemeToggle in footer', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, '../../components/sidebar-nav.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('ThemeToggle')
  })

  it('sidebar-nav.tsx uses w-12 for collapsed width', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, '../../components/sidebar-nav.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('w-12')
  })
})
