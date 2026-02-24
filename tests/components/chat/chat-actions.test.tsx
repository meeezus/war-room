import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatActions } from '@/components/chat/chat-actions'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ChatActions', () => {
  const defaultProps = {
    messageContent: 'This is a test assistant message with some content for pre-filling',
    threadId: 'thread-123',
  }

  describe('rendering', () => {
    it('renders both action buttons', () => {
      render(<ChatActions {...defaultProps} />)
      expect(screen.getByText('Create Proposal')).toBeInTheDocument()
      expect(screen.getByText('Create Objective')).toBeInTheDocument()
    })

    it('does not show any form by default', () => {
      render(<ChatActions {...defaultProps} />)
      expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/description/i)).not.toBeInTheDocument()
    })
  })

  describe('proposal form', () => {
    it('opens proposal form when button is clicked', async () => {
      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Proposal'))
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/domain/i)).toBeInTheDocument()
    })

    it('pre-fills title with first 80 chars of messageContent', async () => {
      const longContent = 'A'.repeat(120)
      render(<ChatActions messageContent={longContent} threadId="t-1" />)
      await userEvent.click(screen.getByText('Create Proposal'))
      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement
      expect(titleInput.value).toBe('A'.repeat(80))
    })

    it('pre-fills description with full messageContent', async () => {
      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Proposal'))
      const descTextarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement
      expect(descTextarea.value).toBe(defaultProps.messageContent)
    })

    it('has domain select with correct options', async () => {
      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Proposal'))
      const domainSelect = screen.getByLabelText(/domain/i) as HTMLSelectElement
      const options = Array.from(domainSelect.options).map(o => o.value)
      expect(options).toContain('engineering')
      expect(options).toContain('product')
      expect(options).toContain('operations')
      expect(options).toContain('commerce')
      expect(options).toContain('influence')
      expect(options).toContain('coordination')
    })

    it('submits proposal form and shows success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proposal: { id: 'prop-abc-123' } }),
      })

      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Proposal'))
      await userEvent.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/proposals', expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }))
      })

      await waitFor(() => {
        expect(screen.getByText(/proposal created/i)).toBeInTheDocument()
        expect(screen.getByText(/prop-abc-123/i)).toBeInTheDocument()
      })
    })

    it('closes form after successful submission', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proposal: { id: 'prop-xyz' } }),
      })

      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Proposal'))
      await userEvent.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(screen.getByText(/proposal created/i)).toBeInTheDocument()
      })

      // Form fields should be gone
      expect(screen.queryByLabelText(/domain/i)).not.toBeInTheDocument()
    })

    it('clears success message after 3 seconds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proposal: { id: 'prop-temp' } }),
      })

      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Proposal'))
      await userEvent.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(screen.getByText(/proposal created/i)).toBeInTheDocument()
      })

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      await waitFor(() => {
        expect(screen.queryByText(/proposal created/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('objective form', () => {
    it('opens objective form when button is clicked', async () => {
      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Objective'))
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/success criteria/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/max iterations/i)).toBeInTheDocument()
    })

    it('pre-fills description with messageContent', async () => {
      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Objective'))
      const descTextarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement
      expect(descTextarea.value).toBe(defaultProps.messageContent)
    })

    it('has max_iterations defaulting to 5', async () => {
      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Objective'))
      const iterInput = screen.getByLabelText(/max iterations/i) as HTMLInputElement
      expect(iterInput.value).toBe('5')
    })

    it('submits objective form and shows success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ objective: { id: 'obj-def-456' } }),
      })

      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Objective'))

      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement
      await userEvent.type(titleInput, 'Test Objective')

      const criteriaTextarea = screen.getByLabelText(/success criteria/i) as HTMLTextAreaElement
      await userEvent.type(criteriaTextarea, 'Ship it')

      await userEvent.click(screen.getByText('Submit Objective'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/objectives', expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }))
      })

      await waitFor(() => {
        expect(screen.getByText(/objective created/i)).toBeInTheDocument()
        expect(screen.getByText(/obj-def-456/i)).toBeInTheDocument()
      })
    })
  })

  describe('form switching', () => {
    it('closes proposal form when objective button is clicked', async () => {
      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Proposal'))
      expect(screen.getByLabelText(/domain/i)).toBeInTheDocument()

      await userEvent.click(screen.getByText('Create Objective'))
      expect(screen.queryByLabelText(/domain/i)).not.toBeInTheDocument()
      expect(screen.getByLabelText(/success criteria/i)).toBeInTheDocument()
    })

    it('closes objective form when proposal button is clicked', async () => {
      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Objective'))
      expect(screen.getByLabelText(/success criteria/i)).toBeInTheDocument()

      await userEvent.click(screen.getByText('Create Proposal'))
      expect(screen.queryByLabelText(/success criteria/i)).not.toBeInTheDocument()
      expect(screen.getByLabelText(/domain/i)).toBeInTheDocument()
    })

    it('toggles form closed when same button is clicked again', async () => {
      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Proposal'))
      expect(screen.getByLabelText(/domain/i)).toBeInTheDocument()

      await userEvent.click(screen.getByText('Create Proposal'))
      expect(screen.queryByLabelText(/domain/i)).not.toBeInTheDocument()
    })
  })

  describe('escape key', () => {
    it('closes active form on Escape key press', async () => {
      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Proposal'))
      expect(screen.getByLabelText(/domain/i)).toBeInTheDocument()

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(screen.queryByLabelText(/domain/i)).not.toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('shows error when API returns non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Bad request' }),
      })

      render(<ChatActions {...defaultProps} />)
      await userEvent.click(screen.getByText('Create Proposal'))
      await userEvent.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(screen.getByText(/bad request/i)).toBeInTheDocument()
      })
    })
  })
})
