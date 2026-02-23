import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentSelector } from '@/components/chat/agent-selector'

describe('AgentSelector', () => {
  const defaultProps = {
    open: true,
    onSelect: vi.fn(),
    onClose: vi.fn(),
  }

  function renderSelector(overrides = {}) {
    return render(<AgentSelector {...defaultProps} {...overrides} />)
  }

  describe('rendering', () => {
    it('renders nothing when open is false', () => {
      const { container } = renderSelector({ open: false })
      expect(container.innerHTML).toBe('')
    })

    it('renders the modal when open is true', () => {
      renderSelector()
      expect(screen.getByText('New conversation with...')).toBeInTheDocument()
    })

    it('renders exactly 9 selectable agents', () => {
      renderSelector()
      const expectedNames = [
        'Claude Code', 'Makima', 'Ed', 'Light', 'Major',
        'Bulma', 'L', 'Nanami', 'Armin',
      ]
      for (const name of expectedNames) {
        expect(screen.getByText(name)).toBeInTheDocument()
      }
    })

    it('does NOT render pip, toji, or power', () => {
      renderSelector()
      expect(screen.queryByText('Pip')).not.toBeInTheDocument()
      expect(screen.queryByText('Toji')).not.toBeInTheDocument()
      expect(screen.queryByText('Power')).not.toBeInTheDocument()
    })

    it('renders specialty labels for each agent', () => {
      renderSelector()
      const specialties = [
        'General', 'Synthesis', 'Engineering', 'Strategy', 'Operations',
        'Product', 'Analysis', 'Finance', 'Research',
      ]
      for (const specialty of specialties) {
        expect(screen.getByText(specialty)).toBeInTheDocument()
      }
    })

    it('renders avatar images with correct src paths', () => {
      renderSelector()
      const images = screen.getAllByRole('img')
      expect(images).toHaveLength(9)

      const expectedIds = ['cc', 'makima', 'ed', 'light', 'major', 'bulma', 'l', 'nanami', 'armin']
      for (const id of expectedIds) {
        const img = images.find((i) => (i as HTMLImageElement).src.includes(`/avatars/${id}.webp`))
        expect(img).toBeDefined()
      }
    })
  })

  describe('interactions', () => {
    it('calls onSelect with agent id when clicking an agent card', () => {
      const onSelect = vi.fn()
      renderSelector({ onSelect })

      fireEvent.click(screen.getByText('Makima'))
      expect(onSelect).toHaveBeenCalledWith('makima')
    })

    it('calls onSelect with cc when clicking Claude Code', () => {
      const onSelect = vi.fn()
      renderSelector({ onSelect })

      fireEvent.click(screen.getByText('Claude Code'))
      expect(onSelect).toHaveBeenCalledWith('cc')
    })

    it('calls onClose when clicking the backdrop overlay', () => {
      const onClose = vi.fn()
      renderSelector({ onClose })

      const backdrop = screen.getByTestId('agent-selector-backdrop')
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when pressing Escape key', () => {
      const onClose = vi.fn()
      renderSelector({ onClose })

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not call onClose when clicking inside the modal card', () => {
      const onClose = vi.fn()
      renderSelector({ onClose })

      fireEvent.click(screen.getByText('New conversation with...'))
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('styling', () => {
    it('renders backdrop with correct classes', () => {
      renderSelector()
      const backdrop = screen.getByTestId('agent-selector-backdrop')
      expect(backdrop.className).toContain('bg-black/60')
      expect(backdrop.className).toContain('backdrop-blur-sm')
    })

    it('renders modal card with dark theme classes', () => {
      renderSelector()
      const modal = screen.getByTestId('agent-selector-modal')
      expect(modal.className).toContain('bg-zinc-900')
      expect(modal.className).toContain('border-zinc-800')
      expect(modal.className).toContain('rounded-lg')
    })

    it('CC agent has a green accent ring', () => {
      renderSelector()
      // CC is the default agent; its avatar wrapper should have emerald ring
      const ccCard = screen.getByTestId('agent-card-cc')
      expect(ccCard.innerHTML).toContain('ring-emerald')
    })

    it('renders a 3-column grid', () => {
      renderSelector()
      const grid = screen.getByTestId('agent-grid')
      expect(grid.className).toContain('grid-cols-3')
    })
  })
})
