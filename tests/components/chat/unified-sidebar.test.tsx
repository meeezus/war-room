import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UnifiedSidebar } from '@/components/chat/unified-sidebar'
import type { ThreadSummary } from '@/components/chat/thread-list'
import type { Category, Channel } from '@/components/chat/channel-sidebar'

const mockThreads: ThreadSummary[] = [
  {
    id: 'thread-1',
    title: 'First thread',
    last_message: 'Hello',
    last_message_at: new Date().toISOString(),
    agent_id: null,
  },
  {
    id: 'thread-2',
    title: 'Second thread',
    last_message: 'World',
    last_message_at: new Date().toISOString(),
    agent_id: 'agent-1',
  },
]

const mockCategories: Category[] = [
  { id: 'cat-1', name: 'General', collapsed: false },
]

const mockChannels: Channel[] = [
  { id: 'ch-1', category_id: 'cat-1', name: 'announcements', is_default: true },
  { id: 'ch-2', category_id: null, name: 'random', is_default: false },
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

describe('UnifiedSidebar', () => {
  describe('tab rendering', () => {
    it('renders both tab buttons', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      expect(screen.getByRole('button', { name: /direct messages/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /channels/i })).toBeInTheDocument()
    })

    it('shows DMs tab as active by default', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      const dmTab = screen.getByRole('button', { name: /direct messages/i })
      expect(dmTab.className).toContain('text-emerald-400')
      expect(dmTab.className).toContain('border-emerald-500')
    })

    it('shows Channels tab as inactive by default', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      const channelsTab = screen.getByRole('button', { name: /channels/i })
      expect(channelsTab.className).not.toContain('text-emerald-400')
      expect(channelsTab.className).toContain('text-muted-foreground')
    })
  })

  describe('DMs view (default)', () => {
    it('renders ThreadList content when DMs tab is active', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      // ThreadList renders thread titles
      expect(screen.getByText('First thread')).toBeInTheDocument()
      expect(screen.getByText('Second thread')).toBeInTheDocument()
    })

    it('does not render ChannelSidebar content when DMs tab is active', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      // Channel names should not be visible
      expect(screen.queryByText('announcements')).not.toBeInTheDocument()
    })
  })

  describe('switching tabs', () => {
    it('switches to Channels view when Channels tab is clicked', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      fireEvent.click(screen.getByRole('button', { name: /channels/i }))

      // Channels tab should now be active
      const channelsTab = screen.getByRole('button', { name: /channels/i })
      expect(channelsTab.className).toContain('text-emerald-400')
      expect(channelsTab.className).toContain('border-emerald-500')

      // DMs tab should be inactive
      const dmTab = screen.getByRole('button', { name: /direct messages/i })
      expect(dmTab.className).not.toContain('text-emerald-400')
    })

    it('renders ChannelSidebar content after switching to Channels', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      fireEvent.click(screen.getByRole('button', { name: /channels/i }))

      expect(screen.getByText('announcements')).toBeInTheDocument()
      expect(screen.getByText('random')).toBeInTheDocument()
    })

    it('hides ThreadList content after switching to Channels', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      fireEvent.click(screen.getByRole('button', { name: /channels/i }))

      expect(screen.queryByText('First thread')).not.toBeInTheDocument()
    })

    it('switches back to DMs when DMs tab is clicked again', () => {
      render(<UnifiedSidebar {...defaultProps} />)
      // Switch to channels
      fireEvent.click(screen.getByRole('button', { name: /channels/i }))
      // Switch back to DMs
      fireEvent.click(screen.getByRole('button', { name: /direct messages/i }))

      expect(screen.getByText('First thread')).toBeInTheDocument()
      expect(screen.queryByText('announcements')).not.toBeInTheDocument()
    })
  })

  describe('prop passthrough', () => {
    it('passes onSelectThread to ThreadList', () => {
      const onSelectThread = vi.fn()
      render(<UnifiedSidebar {...defaultProps} onSelectThread={onSelectThread} />)
      // Click a thread - ThreadList renders buttons for each thread
      const threadButton = screen.getByText('First thread').closest('button')
      if (threadButton) {
        fireEvent.click(threadButton)
        expect(onSelectThread).toHaveBeenCalledWith('thread-1')
      }
    })

    it('passes onSelectChannel to ChannelSidebar', () => {
      const onSelectChannel = vi.fn()
      render(<UnifiedSidebar {...defaultProps} onSelectChannel={onSelectChannel} />)
      fireEvent.click(screen.getByRole('button', { name: /channels/i }))

      const channelButton = screen.getByRole('button', { name: /announcements/ })
      fireEvent.click(channelButton)
      expect(onSelectChannel).toHaveBeenCalledWith('ch-1')
    })

    it('passes activeThreadId to highlight the active thread', () => {
      render(<UnifiedSidebar {...defaultProps} activeThreadId="thread-1" />)
      // The active thread should have distinct styling (emerald highlight)
      const threadButton = screen.getByText('First thread').closest('button')
      expect(threadButton?.className).toContain('bg-emerald-500/10')
    })

    it('passes activeChannelId to highlight the active channel', () => {
      render(<UnifiedSidebar {...defaultProps} activeChannelId="ch-1" />)
      fireEvent.click(screen.getByRole('button', { name: /channels/i }))

      const channelButton = screen.getByRole('button', { name: /announcements/ })
      expect(channelButton.className).toContain('bg-emerald-500/10')
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
})
