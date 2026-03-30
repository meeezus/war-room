import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockPathname } = vi.hoisted(() => ({
  mockPathname: vi.fn().mockReturnValue('/dashboard'),
}))

vi.mock('next/navigation', () => ({
  usePathname: mockPathname,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className, ...props }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className} {...props}>{children}</a>
  ),
}))

vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: ({ collapsed }: { collapsed?: boolean }) => (
    <button data-testid="theme-toggle" data-collapsed={collapsed}>ThemeToggle</button>
  ),
}))

import { SidebarNav } from '@/components/sidebar-nav'

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  }
})()

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })
  localStorageMock.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SidebarNav', () => {
  describe('expanded state (default)', () => {
    it('renders with full width (200px) by default', () => {
      const { container } = render(<SidebarNav />)
      const nav = container.querySelector('nav')
      expect(nav).toBeTruthy()
      expect(nav?.className).toMatch(/w-\[200px\]/)
    })

    it('renders brand text "Tenshu"', () => {
      render(<SidebarNav />)
      expect(screen.getByText('Tenshu')).toBeTruthy()
    })

    it('renders nav labels with text', () => {
      render(<SidebarNav />)
      expect(screen.getByText('Overview')).toBeTruthy()
      expect(screen.getByText('Agents')).toBeTruthy()
      expect(screen.getByText('Tasks')).toBeTruthy()
      expect(screen.getByText('Sessions')).toBeTruthy()
    })

    it('renders section headers', () => {
      render(<SidebarNav />)
      expect(screen.getByText('OBSERVE')).toBeTruthy()
      expect(screen.getByText('AUTOMATE')).toBeTruthy()
      expect(screen.getByText('SYSTEM')).toBeTruthy()
    })

    it('renders the collapse toggle button', () => {
      render(<SidebarNav />)
      const toggleBtn = screen.getByRole('button', { name: /collapse sidebar/i })
      expect(toggleBtn).toBeTruthy()
    })

    it('renders ThemeToggle', () => {
      render(<SidebarNav />)
      expect(screen.getByTestId('theme-toggle')).toBeTruthy()
    })
  })

  describe('collapsed state', () => {
    it('collapses when toggle button is clicked', () => {
      const { container } = render(<SidebarNav />)
      const toggleBtn = screen.getByRole('button', { name: /collapse sidebar/i })
      fireEvent.click(toggleBtn)

      const nav = container.querySelector('nav')
      expect(nav?.className).toMatch(/w-12/)
      expect(nav?.className).not.toMatch(/w-\[200px\]/)
    })

    it('hides text labels when collapsed', () => {
      render(<SidebarNav />)
      fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }))

      // Text labels should be hidden (via sr-only or not rendered)
      const overviewText = screen.queryByText('Overview')
      // It should either not exist or be visually hidden (sr-only)
      if (overviewText) {
        expect(overviewText.className).toMatch(/sr-only/)
      }
    })

    it('hides section headers when collapsed', () => {
      render(<SidebarNav />)
      fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }))

      expect(screen.queryByText('OBSERVE')).toBeNull()
      expect(screen.queryByText('AUTOMATE')).toBeNull()
      expect(screen.queryByText('SYSTEM')).toBeNull()
    })

    it('hides brand subtitle when collapsed', () => {
      render(<SidebarNav />)
      fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }))

      expect(screen.queryByText(/Shogunate/)).toBeNull()
    })

    it('shows expand button after collapsing', () => {
      render(<SidebarNav />)
      fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }))

      const expandBtn = screen.getByRole('button', { name: /expand sidebar/i })
      expect(expandBtn).toBeTruthy()
    })

    it('expands back when expand button is clicked', () => {
      const { container } = render(<SidebarNav />)

      // Collapse
      fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }))
      expect(container.querySelector('nav')?.className).toMatch(/w-12/)

      // Expand
      fireEvent.click(screen.getByRole('button', { name: /expand sidebar/i }))
      expect(container.querySelector('nav')?.className).toMatch(/w-\[200px\]/)
    })
  })

  describe('localStorage persistence', () => {
    it('saves collapsed state to localStorage', () => {
      render(<SidebarNav />)
      fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }))

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tenshu-sidebar-collapsed',
        'true'
      )
    })

    it('reads collapsed state from localStorage on mount', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'tenshu-sidebar-collapsed') return 'true'
        return null
      })
      const { container } = render(<SidebarNav />)

      const nav = container.querySelector('nav')
      expect(nav?.className).toMatch(/w-12/)
    })

    it('defaults to expanded when localStorage is empty', () => {
      localStorageMock.getItem.mockReturnValue(null)
      const { container } = render(<SidebarNav />)

      const nav = container.querySelector('nav')
      expect(nav?.className).toMatch(/w-\[200px\]/)
    })
  })

  describe('tooltips on collapsed icons', () => {
    it('shows title attributes on links when collapsed', () => {
      const { container } = render(<SidebarNav />)
      fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }))

      const links = container.querySelectorAll('a[title]')
      expect(links.length).toBeGreaterThan(0)

      // Check specific links have correct titles
      const overviewLink = container.querySelector('a[href="/dashboard"]')
      expect(overviewLink?.getAttribute('title')).toBe('Overview')

      const agentsLink = container.querySelector('a[href="/agents"]')
      expect(agentsLink?.getAttribute('title')).toBe('Agents')
    })
  })

  describe('ThemeToggle integration', () => {
    it('passes collapsed prop to ThemeToggle', () => {
      render(<SidebarNav />)
      fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }))

      const toggle = screen.getByTestId('theme-toggle')
      expect(toggle.getAttribute('data-collapsed')).toBe('true')
    })
  })
})
