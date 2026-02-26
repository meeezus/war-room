import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChannelSidebar, Category, Channel } from '@/components/chat/channel-sidebar'

const mockCategories: Category[] = [
  { id: 'cat-1', name: 'General', collapsed: false },
  { id: 'cat-2', name: 'Projects', collapsed: true },
]

const mockChannels: Channel[] = [
  { id: 'ch-1', category_id: 'cat-1', name: 'announcements', is_default: true },
  { id: 'ch-2', category_id: 'cat-1', name: 'random', is_default: false },
  { id: 'ch-3', category_id: 'cat-2', name: 'alpha', is_default: false },
  { id: 'ch-4', category_id: null, name: 'uncategorized-chat', is_default: false },
]

const defaultProps = {
  categories: mockCategories,
  channels: mockChannels,
  activeChannelId: null,
  onSelectChannel: vi.fn(),
}

describe('ChannelSidebar', () => {
  describe('rendering', () => {
    it('renders the Channels header', () => {
      render(<ChannelSidebar {...defaultProps} />)
      expect(screen.getByText('Channels')).toBeInTheDocument()
    })

    it('renders category names in uppercase', () => {
      render(<ChannelSidebar {...defaultProps} />)
      expect(screen.getByText('GENERAL')).toBeInTheDocument()
      expect(screen.getByText('PROJECTS')).toBeInTheDocument()
    })

    it('renders channels under expanded categories', () => {
      render(<ChannelSidebar {...defaultProps} />)
      // cat-1 (General) is not collapsed, so its channels should be visible
      expect(screen.getByText('announcements')).toBeInTheDocument()
      expect(screen.getByText('random')).toBeInTheDocument()
    })

    it('hides channels under collapsed categories', () => {
      render(<ChannelSidebar {...defaultProps} />)
      // cat-2 (Projects) is collapsed, so its channels should not be visible
      expect(screen.queryByText('alpha')).not.toBeInTheDocument()
    })

    it('renders uncategorized channels at the bottom', () => {
      render(<ChannelSidebar {...defaultProps} />)
      expect(screen.getByText('uncategorized-chat')).toBeInTheDocument()
    })

    it('renders hash icon for each visible channel', () => {
      render(<ChannelSidebar {...defaultProps} />)
      // announcements, random, uncategorized-chat should be visible (3 channels)
      // Each has a Hash icon - we check by testid or role
      const channelButtons = screen.getAllByRole('button', { name: /announcements|random|uncategorized-chat/ })
      expect(channelButtons).toHaveLength(3)
    })
  })

  describe('active channel', () => {
    it('highlights the active channel with emerald styling', () => {
      render(<ChannelSidebar {...defaultProps} activeChannelId="ch-1" />)
      const activeButton = screen.getByRole('button', { name: /announcements/ })
      expect(activeButton.className).toContain('bg-emerald-500/10')
      expect(activeButton.className).toContain('text-emerald-400')
    })

    it('does not highlight non-active channels', () => {
      render(<ChannelSidebar {...defaultProps} activeChannelId="ch-1" />)
      const inactiveButton = screen.getByRole('button', { name: /random/ })
      expect(inactiveButton.className).not.toContain('bg-emerald-500/10')
    })
  })

  describe('interactions', () => {
    it('calls onSelectChannel when a channel is clicked', () => {
      const onSelectChannel = vi.fn()
      render(<ChannelSidebar {...defaultProps} onSelectChannel={onSelectChannel} />)
      fireEvent.click(screen.getByRole('button', { name: /announcements/ }))
      expect(onSelectChannel).toHaveBeenCalledWith('ch-1')
    })

    it('calls onToggleCategory when category header is clicked', () => {
      const onToggleCategory = vi.fn()
      render(<ChannelSidebar {...defaultProps} onToggleCategory={onToggleCategory} />)
      fireEvent.click(screen.getByText('GENERAL'))
      expect(onToggleCategory).toHaveBeenCalledWith('cat-1')
    })

    it('calls onCreateCategory when header + button is clicked', () => {
      const onCreateCategory = vi.fn()
      render(<ChannelSidebar {...defaultProps} onCreateCategory={onCreateCategory} />)
      // The header + button is the one next to "Channels"
      const headerPlusButton = screen.getAllByRole('button').find(
        btn => btn.closest('[data-testid="sidebar-header"]')
      )
      expect(headerPlusButton).toBeDefined()
      fireEvent.click(headerPlusButton!)
      expect(onCreateCategory).toHaveBeenCalled()
    })
  })

  describe('empty state', () => {
    it('renders with no channels', () => {
      render(
        <ChannelSidebar
          categories={mockCategories}
          channels={[]}
          activeChannelId={null}
          onSelectChannel={vi.fn()}
        />
      )
      expect(screen.getByText('Channels')).toBeInTheDocument()
      expect(screen.getByText('GENERAL')).toBeInTheDocument()
    })

    it('renders with no categories and only uncategorized channels', () => {
      render(
        <ChannelSidebar
          categories={[]}
          channels={[{ id: 'ch-solo', category_id: null, name: 'solo', is_default: false }]}
          activeChannelId={null}
          onSelectChannel={vi.fn()}
        />
      )
      expect(screen.getByText('solo')).toBeInTheDocument()
    })
  })
})
