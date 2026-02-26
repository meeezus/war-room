import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForwardModal } from '@/components/chat/forward-modal'
import type { Channel } from '@/components/chat/channel-sidebar'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 'ch-1',
    category_id: null,
    name: 'general',
    is_default: true,
    ...overrides,
  }
}

const channels: Channel[] = [
  makeChannel({ id: 'ch-1', name: 'general', is_default: true }),
  makeChannel({ id: 'ch-2', name: 'strategy', is_default: false }),
  makeChannel({ id: 'ch-3', name: 'engineering', is_default: false }),
  makeChannel({ id: 'ch-4', name: 'operations', is_default: false }),
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ForwardModal', () => {
  const defaultProps = {
    channels,
    currentChannelId: 'ch-1',
    onForward: vi.fn(),
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Structure / Layout
  // -------------------------------------------------------------------------

  it('renders the modal with title', () => {
    render(<ForwardModal {...defaultProps} />)
    expect(screen.getByText('Forward to channel')).toBeInTheDocument()
  })

  it('renders the close button', () => {
    render(<ForwardModal {...defaultProps} />)
    const closeBtn = screen.getByRole('button', { name: /close/i })
    expect(closeBtn).toBeInTheDocument()
  })

  it('renders the search input', () => {
    render(<ForwardModal {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search channels...')).toBeInTheDocument()
  })

  it('renders a dark backdrop overlay', () => {
    const { container } = render(<ForwardModal {...defaultProps} />)
    const backdrop = container.firstChild as HTMLElement
    expect(backdrop.className).toContain('fixed')
    expect(backdrop.className).toContain('inset-0')
    expect(backdrop.className).toContain('z-50')
  })

  // -------------------------------------------------------------------------
  // Channel List Filtering
  // -------------------------------------------------------------------------

  it('excludes the current channel from the list', () => {
    render(<ForwardModal {...defaultProps} />)
    // current channel is 'general' (ch-1)
    expect(screen.queryByText('general')).not.toBeInTheDocument()
    // other channels should be present
    expect(screen.getByText('strategy')).toBeInTheDocument()
    expect(screen.getByText('engineering')).toBeInTheDocument()
    expect(screen.getByText('operations')).toBeInTheDocument()
  })

  it('filters channels by search query', async () => {
    const user = userEvent.setup()
    render(<ForwardModal {...defaultProps} />)

    const searchInput = screen.getByPlaceholderText('Search channels...')
    await user.type(searchInput, 'eng')

    expect(screen.getByText('engineering')).toBeInTheDocument()
    expect(screen.queryByText('strategy')).not.toBeInTheDocument()
    expect(screen.queryByText('operations')).not.toBeInTheDocument()
  })

  it('search is case-insensitive', async () => {
    const user = userEvent.setup()
    render(<ForwardModal {...defaultProps} />)

    const searchInput = screen.getByPlaceholderText('Search channels...')
    await user.type(searchInput, 'STRATEGY')

    expect(screen.getByText('strategy')).toBeInTheDocument()
  })

  it('shows empty state when no channels match search', async () => {
    const user = userEvent.setup()
    render(<ForwardModal {...defaultProps} />)

    const searchInput = screen.getByPlaceholderText('Search channels...')
    await user.type(searchInput, 'nonexistent')

    expect(screen.getByText('No channels found')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Interactions
  // -------------------------------------------------------------------------

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<ForwardModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onForward with the channel id when a channel is clicked', () => {
    const onForward = vi.fn()
    render(<ForwardModal {...defaultProps} onForward={onForward} />)
    fireEvent.click(screen.getByText('strategy'))
    expect(onForward).toHaveBeenCalledWith('ch-2')
  })

  it('auto-focuses the search input', () => {
    render(<ForwardModal {...defaultProps} />)
    const searchInput = screen.getByPlaceholderText('Search channels...')
    expect(searchInput).toHaveFocus()
  })

  // -------------------------------------------------------------------------
  // Edge Cases
  // -------------------------------------------------------------------------

  it('renders all channels except current when search is empty', () => {
    render(<ForwardModal {...defaultProps} />)
    const buttons = screen.getAllByRole('button')
    // 3 channel buttons + 1 close button = 4
    expect(buttons).toHaveLength(4)
  })

  it('works with an empty channels array', () => {
    render(<ForwardModal {...defaultProps} channels={[]} />)
    expect(screen.getByText('No channels found')).toBeInTheDocument()
  })

  it('works when all channels are the current channel', () => {
    const singleChannel = [makeChannel({ id: 'ch-1', name: 'general' })]
    render(<ForwardModal {...defaultProps} channels={singleChannel} currentChannelId="ch-1" />)
    expect(screen.getByText('No channels found')).toBeInTheDocument()
  })
})
