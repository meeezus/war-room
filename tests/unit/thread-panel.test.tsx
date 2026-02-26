import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThreadPanel } from '@/components/chat/thread-panel'
import type { ChannelMessage } from '@/lib/channels'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessage(overrides: Partial<ChannelMessage> = {}): ChannelMessage {
  return {
    id: 'msg-1',
    channel_id: 'ch-1',
    role: 'assistant',
    content: 'Hello from the war room',
    agent_id: 'light',
    reply_to_id: null,
    thread_id: null,
    thread_count: 0,
    forwarded_from: null,
    created_at: '2026-02-26T12:00:00Z',
    ...overrides,
  }
}

function makeReply(id: string, content: string): ChannelMessage {
  return makeMessage({
    id,
    content,
    thread_id: 'msg-1',
    created_at: `2026-02-26T12:0${id.slice(-1)}:00Z`,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThreadPanel', () => {
  const defaultProps = {
    parentMessage: makeMessage(),
    replies: [] as ChannelMessage[],
    onClose: vi.fn(),
    onSendReply: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Structure / Layout
  // -------------------------------------------------------------------------

  it('renders the Thread header', () => {
    render(<ThreadPanel {...defaultProps} />)
    expect(screen.getByText('Thread')).toBeInTheDocument()
  })

  it('renders the close button', () => {
    render(<ThreadPanel {...defaultProps} />)
    const closeBtn = screen.getByRole('button', { name: /close/i })
    expect(closeBtn).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<ThreadPanel {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders the parent message content', () => {
    render(<ThreadPanel {...defaultProps} />)
    expect(screen.getByText('Hello from the war room')).toBeInTheDocument()
  })

  it('renders the reply input', () => {
    render(<ThreadPanel {...defaultProps} />)
    expect(screen.getByPlaceholderText('Reply in thread...')).toBeInTheDocument()
  })

  it('renders the send button', () => {
    render(<ThreadPanel {...defaultProps} />)
    const sendBtn = screen.getByRole('button', { name: /send/i })
    expect(sendBtn).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Reply count
  // -------------------------------------------------------------------------

  it('shows "0 replies" when there are no replies', () => {
    render(<ThreadPanel {...defaultProps} replies={[]} />)
    expect(screen.getByText('0 replies')).toBeInTheDocument()
  })

  it('shows "1 reply" for a single reply', () => {
    render(
      <ThreadPanel
        {...defaultProps}
        replies={[makeReply('r-1', 'First reply')]}
      />
    )
    expect(screen.getByText('1 reply')).toBeInTheDocument()
  })

  it('shows "3 replies" for multiple replies', () => {
    const replies = [
      makeReply('r-1', 'Reply one'),
      makeReply('r-2', 'Reply two'),
      makeReply('r-3', 'Reply three'),
    ]
    render(<ThreadPanel {...defaultProps} replies={replies} />)
    expect(screen.getByText('3 replies')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Replies rendering
  // -------------------------------------------------------------------------

  it('renders all reply messages', () => {
    const replies = [
      makeReply('r-1', 'Reply one'),
      makeReply('r-2', 'Reply two'),
    ]
    render(<ThreadPanel {...defaultProps} replies={replies} />)
    expect(screen.getByText('Reply one')).toBeInTheDocument()
    expect(screen.getByText('Reply two')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Send reply
  // -------------------------------------------------------------------------

  it('calls onSendReply with input value on submit', async () => {
    const user = userEvent.setup()
    const onSendReply = vi.fn()
    render(<ThreadPanel {...defaultProps} onSendReply={onSendReply} />)

    const input = screen.getByPlaceholderText('Reply in thread...')
    await user.type(input, 'My reply')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(onSendReply).toHaveBeenCalledWith('My reply')
  })

  it('clears input after sending a reply', async () => {
    const user = userEvent.setup()
    render(<ThreadPanel {...defaultProps} />)

    const input = screen.getByPlaceholderText('Reply in thread...')
    await user.type(input, 'My reply')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(input).toHaveValue('')
  })

  it('does not send when input is empty', async () => {
    const user = userEvent.setup()
    const onSendReply = vi.fn()
    render(<ThreadPanel {...defaultProps} onSendReply={onSendReply} />)

    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(onSendReply).not.toHaveBeenCalled()
  })

  it('does not send when input is only whitespace', async () => {
    const user = userEvent.setup()
    const onSendReply = vi.fn()
    render(<ThreadPanel {...defaultProps} onSendReply={onSendReply} />)

    const input = screen.getByPlaceholderText('Reply in thread...')
    await user.type(input, '   ')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(onSendReply).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('disables input and send button when isLoading is true', () => {
    render(<ThreadPanel {...defaultProps} isLoading={true} />)

    const input = screen.getByPlaceholderText('Reply in thread...')
    expect(input).toBeDisabled()

    const sendBtn = screen.getByRole('button', { name: /send/i })
    expect(sendBtn).toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Panel structure
  // -------------------------------------------------------------------------

  it('has the correct panel data-testid', () => {
    render(<ThreadPanel {...defaultProps} />)
    expect(screen.getByTestId('thread-panel')).toBeInTheDocument()
  })
})
