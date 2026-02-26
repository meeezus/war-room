import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UnifiedSidebar } from '@/components/chat/unified-sidebar'
import type { ThreadSummary } from '@/components/chat/thread-list'
import type { Category, Channel } from '@/components/chat/channel-sidebar'

const mockThreads: ThreadSummary[] = [
  {
    id: 'thread-1',
    title: 'Makima',
    last_message: 'Hello',
    last_message_at: new Date().toISOString(),
    agent_id: 'makima',
  },
  {
    id: 'thread-2',
    title: 'Research Thread',
    last_message: 'World',
    last_message_at: new Date().toISOString(),
    agent_id: 'cc',
  },
]

const mockCategories: Category[] = [
  { id: 'cat-1', name: 'General', collapsed: false },
  { id: 'cat-2', name: 'Research', collapsed: true },
]

const mockChannels: Channel[] = [
  { id: 'ch-1', category_id: 'cat-1', name: 'general', is_default: true },
  { id: 'ch-2', category_id: 'cat-1', name: 'alerts', is_default: false },
  { id: 'ch-3', category_id: 'cat-2', name: 'papers', is_default: false },
  { id: 'ch-4', category_id: null, name: 'random', is_default: false },
]

const defaultProps = {
  // DM props
  threads: mockThreads,
  activeThreadId: null,
  onSelectThread: vi.fn(),
  onNewThread: vi.fn(),
  // Channel props
  categories: mockCategories,
  channels: mockChannels,
  activeChannelId: null,
  onSelectChannel: vi.fn(),
}

describe('UnifiedSidebar (Slack-style)', () => {
  describe('no tabs - single unified list', () => {
    it('does NOT render DMs/Channels tab buttons', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      // There should be no tab buttons for switching between DMs and Channels
      const dmTabButton = screen.queryByRole('button', { name: /^direct messages$/i })
      const channelsTabButton = screen.queryByRole('button', { name: /^channels$/i })
      // These should not exist as clickable tab buttons
      // Section headers exist as text but not as tab-switching buttons
      expect(dmTabButton).toBeNull()
      expect(channelsTabButton).toBeNull()
    })

    it('renders both DMs and channels simultaneously', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      // DM threads should be visible
      expect(screen.getByText('Makima')).toBeInTheDocument()
      expect(screen.getByText('Research Thread')).toBeInTheDocument()
      // Channel names should also be visible (from expanded category)
      expect(screen.getByText('general')).toBeInTheDocument()
      expect(screen.getByText('alerts')).toBeInTheDocument()
    })
  })

  describe('DMs section', () => {
    it('renders a "Direct Messages" section header', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      expect(screen.getByText(/direct messages/i)).toBeInTheDocument()
    })

    it('renders a new DM button next to the section header', () => {
      const onNewThread = vi.fn()
      render(<UnifiedSidebar {...defaultProps} onNewThread={onNewThread} />)
      const newDmButton = screen.getByTitle('New DM')
      expect(newDmButton).toBeInTheDocument()
      fireEvent.click(newDmButton)
      expect(onNewThread).toHaveBeenCalled()
    })

    it('renders all DM threads', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      expect(screen.getByText('Makima')).toBeInTheDocument()
      expect(screen.getByText('Research Thread')).toBeInTheDocument()
    })

    it('highlights the active DM thread', () => {
      render(<UnifiedSidebar {...defaultProps} activeThreadId="thread-1" />)
      const threadButton = screen.getByText('Makima').closest('button')
      expect(threadButton?.className).toContain('bg-emerald-500/10')
    })

    it('calls onSelectThread when a DM is clicked', () => {
      const onSelectThread = vi.fn()
      render(<UnifiedSidebar {...defaultProps} onSelectThread={onSelectThread} />)
      const threadButton = screen.getByText('Makima').closest('button')
      if (threadButton) fireEvent.click(threadButton)
      expect(onSelectThread).toHaveBeenCalledWith('thread-1')
    })

    it('renders agent avatar for agent threads', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      const avatar = screen.getByAltText('makima')
      expect(avatar).toBeInTheDocument()
      expect(avatar).toHaveAttribute('src', '/avatars/makima.webp')
    })
  })

  describe('categories + channels section', () => {
    it('renders category names as section headers', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      expect(screen.getByText('GENERAL')).toBeInTheDocument()
      expect(screen.getByText('RESEARCH')).toBeInTheDocument()
    })

    it('renders channels under expanded categories', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      // General is expanded
      expect(screen.getByText('general')).toBeInTheDocument()
      expect(screen.getByText('alerts')).toBeInTheDocument()
    })

    it('hides channels under collapsed categories', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      // Research is collapsed
      expect(screen.queryByText('papers')).not.toBeInTheDocument()
    })

    it('renders uncategorized channels', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      expect(screen.getByText('random')).toBeInTheDocument()
    })

    it('calls onToggleCategory when category header is clicked', () => {
      const onToggleCategory = vi.fn()
      render(<UnifiedSidebar {...defaultProps} onToggleCategory={onToggleCategory} />)
      fireEvent.click(screen.getByText('GENERAL'))
      expect(onToggleCategory).toHaveBeenCalledWith('cat-1')
    })

    it('highlights the active channel', () => {
      render(<UnifiedSidebar {...defaultProps} activeChannelId="ch-1" />)
      const channelButton = screen.getByRole('button', { name: /general/ })
      expect(channelButton.className).toContain('bg-emerald-500/10')
    })

    it('calls onSelectChannel when a channel is clicked', () => {
      const onSelectChannel = vi.fn()
      render(<UnifiedSidebar {...defaultProps} onSelectChannel={onSelectChannel} />)
      fireEvent.click(screen.getByRole('button', { name: /general/ }))
      expect(onSelectChannel).toHaveBeenCalledWith('ch-1')
    })

    it('renders hash icon for channels', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      // Each channel button should exist
      const channelButtons = screen.getAllByRole('button', { name: /general|alerts|random/ })
      expect(channelButtons.length).toBe(3)
    })
  })

  describe('header', () => {
    it('renders the Shoin Chat title', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      expect(screen.getByText('Shoin Chat')).toBeInTheDocument()
    })

    it('renders create category button when onCreateCategory is provided', () => {
      const onCreateCategory = vi.fn()
      render(<UnifiedSidebar {...defaultProps} onCreateCategory={onCreateCategory} />)
      const addButton = screen.getByTitle('Add category')
      expect(addButton).toBeInTheDocument()
      fireEvent.click(addButton)
      expect(onCreateCategory).toHaveBeenCalled()
    })
  })

  describe('mutual exclusion of selections', () => {
    it('does not highlight any DM when a channel is active', () => {
      render(
        <UnifiedSidebar
          {...defaultProps}
          activeThreadId={null}
          activeChannelId="ch-1"
        />
      )
      // No DM should be highlighted
      const makimaButton = screen.getByText('Makima').closest('button')
      expect(makimaButton?.className).not.toContain('bg-emerald-500/10')
    })

    it('does not highlight any channel when a DM is active', () => {
      render(
        <UnifiedSidebar
          {...defaultProps}
          activeThreadId="thread-1"
          activeChannelId={null}
        />
      )
      // No channel should be highlighted
      const channelButton = screen.getByRole('button', { name: /general/ })
      expect(channelButton.className).not.toContain('bg-emerald-500/10')
    })
  })

  describe('container styling', () => {
    it('has the expected background and border classes', () => {
      const { container } = render(<UnifiedSidebar {...defaultProps} />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('bg-background')
      expect(wrapper.className).toContain('border-r')
      expect(wrapper.className).toContain('border-border')
    })
  })

  describe('empty states', () => {
    it('renders with no DM threads', () => {
      render(<UnifiedSidebar {...defaultProps} threads={[]} />)
      // Should still show the Direct Messages header
      expect(screen.getByText(/direct messages/i)).toBeInTheDocument()
      // Categories should still render
      expect(screen.getByText('GENERAL')).toBeInTheDocument()
    })

    it('renders with no categories or channels', () => {
      render(
        <UnifiedSidebar
          {...defaultProps}
          categories={[]}
          channels={[]}
        />
      )
      // DMs should still render
      expect(screen.getByText('Makima')).toBeInTheDocument()
    })
  })
})
