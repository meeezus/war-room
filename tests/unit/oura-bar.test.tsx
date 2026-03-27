import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// components/widgets/oura-bar.tsx — OuraBar component tests
// ---------------------------------------------------------------------------

import { OuraBar } from '@/components/widgets/oura-bar'

describe('OuraBar', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows "Connect Oura" when API returns available: false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ readiness: null, sleep: null, available: false }),
    }))

    render(<OuraBar />)
    await waitFor(() => {
      expect(screen.getByText('Connect Oura')).toBeInTheDocument()
    })
  })

  it('renders readiness and sleep scores when available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ readiness: 72, sleep: 85, available: true }),
    }))

    render(<OuraBar />)
    await waitFor(() => {
      expect(screen.getByText('Readiness')).toBeInTheDocument()
      expect(screen.getByText('72')).toBeInTheDocument()
      expect(screen.getByText('Sleep')).toBeInTheDocument()
      expect(screen.getByText('85')).toBeInTheDocument()
    })
  })

  it('applies green color for scores >= 70', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ readiness: 75, sleep: 80, available: true }),
    }))

    render(<OuraBar />)
    await waitFor(() => {
      const readinessScore = screen.getByText('75')
      const sleepScore = screen.getByText('80')
      expect(readinessScore.className).toContain('text-green-500')
      expect(sleepScore.className).toContain('text-green-500')
    })
  })

  it('applies amber color for scores >= 50 and < 70', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ readiness: 55, sleep: 60, available: true }),
    }))

    render(<OuraBar />)
    await waitFor(() => {
      const readinessScore = screen.getByText('55')
      const sleepScore = screen.getByText('60')
      expect(readinessScore.className).toContain('text-amber-500')
      expect(sleepScore.className).toContain('text-amber-500')
    })
  })

  it('applies red color for scores < 50', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ readiness: 30, sleep: 45, available: true }),
    }))

    render(<OuraBar />)
    await waitFor(() => {
      const readinessScore = screen.getByText('30')
      const sleepScore = screen.getByText('45')
      expect(readinessScore.className).toContain('text-red-500')
      expect(sleepScore.className).toContain('text-red-500')
    })
  })

  it('shows em dash for null scores when available is true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ readiness: null, sleep: null, available: true }),
    }))

    render(<OuraBar />)
    await waitFor(() => {
      expect(screen.getByText('Readiness')).toBeInTheDocument()
      // Both null scores should show em dash
      const dashes = screen.getAllByText('\u2014')
      expect(dashes.length).toBe(2)
    })
  })

  it('shows "Connect Oura" when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    render(<OuraBar />)
    // Initial state before fetch resolves — should not crash
    // After error, health stays null → shows "Connect Oura" fallback
    await waitFor(() => {
      expect(screen.getByText('Connect Oura')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('uses JetBrains Mono font class', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ readiness: 72, sleep: 85, available: true }),
    }))

    const { container } = render(<OuraBar />)
    await waitFor(() => {
      const el = container.firstElementChild
      expect(el?.className).toContain('font-[family-name:var(--font-jetbrains-mono)]')
    })
  })

  it('fetches from /api/health/oura endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ readiness: 70, sleep: 70, available: true }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<OuraBar />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/health/oura')
    })
  })
})
