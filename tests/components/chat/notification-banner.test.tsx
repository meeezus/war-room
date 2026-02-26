import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationBanner } from '@/components/chat/notification-banner'

// Shared store for localStorage mock
let store: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { store = {} }),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock Notification API
const mockNotification = {
  permission: 'default' as NotificationPermission,
  requestPermission: vi.fn(),
}
Object.defineProperty(window, 'Notification', {
  value: mockNotification,
  writable: true,
  configurable: true,
})

beforeEach(() => {
  store = {}
  // Reset call counts but preserve the implementation (reads from `store`)
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  mockNotification.permission = 'default'
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

/** Render and advance past the 3s delay, then switch to real timers for interaction tests */
function renderAndShow(props: { onRequestPermission: () => Promise<boolean> }) {
  const result = render(<NotificationBanner {...props} />)
  act(() => { vi.advanceTimersByTime(3100) })
  vi.useRealTimers()
  return result
}

describe('NotificationBanner', () => {
  const defaultProps = {
    onRequestPermission: vi.fn().mockResolvedValue(true),
  }

  describe('visibility', () => {
    it('is not visible initially (before 3s timer)', () => {
      render(<NotificationBanner {...defaultProps} />)
      expect(screen.queryByText('Get notified when agents respond')).not.toBeInTheDocument()
    })

    it('appears after 3 seconds delay', () => {
      render(<NotificationBanner {...defaultProps} />)
      act(() => { vi.advanceTimersByTime(3000) })
      expect(screen.getByText('Get notified when agents respond')).toBeInTheDocument()
    })

    it('does not appear if permission already granted', () => {
      mockNotification.permission = 'granted'
      render(<NotificationBanner {...defaultProps} />)
      act(() => { vi.advanceTimersByTime(5000) })
      expect(screen.queryByText('Get notified when agents respond')).not.toBeInTheDocument()
    })

    it('does not appear if permission already denied', () => {
      mockNotification.permission = 'denied'
      render(<NotificationBanner {...defaultProps} />)
      act(() => { vi.advanceTimersByTime(5000) })
      expect(screen.queryByText('Get notified when agents respond')).not.toBeInTheDocument()
    })

    it('does not appear if previously dismissed via localStorage', () => {
      store['notification-banner-dismissed'] = 'true'
      render(<NotificationBanner {...defaultProps} />)
      act(() => { vi.advanceTimersByTime(5000) })
      expect(screen.queryByText('Get notified when agents respond')).not.toBeInTheDocument()
    })
  })

  describe('enable button', () => {
    it('calls onRequestPermission when Enable is clicked', async () => {
      const onRequestPermission = vi.fn().mockResolvedValue(true)
      renderAndShow({ onRequestPermission })

      expect(screen.getByText('Enable')).toBeInTheDocument()
      await userEvent.click(screen.getByText('Enable'))

      expect(onRequestPermission).toHaveBeenCalledOnce()
    })

    it('hides banner after successful permission grant', async () => {
      const onRequestPermission = vi.fn().mockResolvedValue(true)
      renderAndShow({ onRequestPermission })

      await userEvent.click(screen.getByText('Enable'))

      await waitFor(() => {
        expect(screen.queryByText('Get notified when agents respond')).not.toBeInTheDocument()
      })
    })

    it('keeps banner visible if permission denied (returns false)', async () => {
      const onRequestPermission = vi.fn().mockResolvedValue(false)
      renderAndShow({ onRequestPermission })

      await userEvent.click(screen.getByText('Enable'))

      await waitFor(() => {
        expect(screen.getByText('Get notified when agents respond')).toBeInTheDocument()
      })
    })

    it('shows loading state while requesting permission', async () => {
      let resolvePermission!: (value: boolean) => void
      const permissionPromise = new Promise<boolean>((resolve) => {
        resolvePermission = resolve
      })
      const onRequestPermission = vi.fn().mockReturnValue(permissionPromise)
      renderAndShow({ onRequestPermission })

      await userEvent.click(screen.getByText('Enable'))

      expect(screen.getByText('...')).toBeInTheDocument()

      await act(async () => { resolvePermission(true) })
    })

    it('disables Enable button while loading', async () => {
      let resolvePermission!: (value: boolean) => void
      const permissionPromise = new Promise<boolean>((resolve) => {
        resolvePermission = resolve
      })
      const onRequestPermission = vi.fn().mockReturnValue(permissionPromise)
      renderAndShow({ onRequestPermission })

      await userEvent.click(screen.getByText('Enable'))

      const loadingBtn = screen.getByText('...')
      expect(loadingBtn).toBeDisabled()

      await act(async () => { resolvePermission(true) })
    })
  })

  describe('dismiss button', () => {
    it('hides banner when dismiss X is clicked', async () => {
      renderAndShow({ onRequestPermission: vi.fn().mockResolvedValue(true) })

      expect(screen.getByText('Get notified when agents respond')).toBeInTheDocument()

      const dismissButtons = screen.getAllByRole('button')
      const dismissButton = dismissButtons[dismissButtons.length - 1]
      await userEvent.click(dismissButton)

      expect(screen.queryByText('Get notified when agents respond')).not.toBeInTheDocument()
    })

    it('stores dismissal in localStorage', async () => {
      renderAndShow({ onRequestPermission: vi.fn().mockResolvedValue(true) })

      const dismissButtons = screen.getAllByRole('button')
      const dismissButton = dismissButtons[dismissButtons.length - 1]
      await userEvent.click(dismissButton)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'notification-banner-dismissed',
        'true'
      )
    })
  })

  describe('cleanup', () => {
    it('clears timeout on unmount', () => {
      const { unmount } = render(<NotificationBanner {...defaultProps} />)
      unmount()
      act(() => { vi.advanceTimersByTime(5000) })
      expect(screen.queryByText('Get notified when agents respond')).not.toBeInTheDocument()
    })
  })
})
