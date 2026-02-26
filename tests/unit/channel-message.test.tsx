import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChannelMessage as ChannelMessageComponent } from '@/components/chat/channel-message'
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChannelMessage', () => {
  it('renders message content', () => {
    render(<ChannelMessageComponent message={makeMessage()} />)
    expect(screen.getByText('Hello from the war room')).toBeInTheDocument()
  })

  it('renders agent name from agent_id', () => {
    render(<ChannelMessageComponent message={makeMessage({ agent_id: 'light' })} />)
    expect(screen.getByText('Light')).toBeInTheDocument()
  })

  it('renders avatar image for known agent', () => {
    render(<ChannelMessageComponent message={makeMessage({ agent_id: 'light' })} />)
    const img = screen.getByRole('img', { name: /light/i })
    expect(img).toHaveAttribute('src', '/avatars/light.webp')
  })

  it('renders fallback initial when no agent_id', () => {
    render(
      <ChannelMessageComponent message={makeMessage({ agent_id: null, role: 'user' })} />
    )
    // Should show a fallback initial "U" for user
    expect(screen.getByText('U')).toBeInTheDocument()
  })

  it('renders formatted timestamp', () => {
    render(<ChannelMessageComponent message={makeMessage()} />)
    // The timestamp should be displayed in some human-readable form
    const timeEl = screen.getByTestId('message-timestamp')
    expect(timeEl).toBeInTheDocument()
    expect(timeEl.textContent).toBeTruthy()
  })

  it('preserves whitespace in content', () => {
    const content = 'line one\n  indented\n    more indented'
    render(<ChannelMessageComponent message={makeMessage({ content })} />)
    const contentEl = screen.getByTestId('message-content')
    expect(contentEl).toHaveStyle({ whiteSpace: 'pre-wrap' })
  })

  // -------------------------------------------------------------------------
  // Reply context
  // -------------------------------------------------------------------------

  it('shows reply context when replyToMessage is provided', () => {
    const replyTo = makeMessage({ id: 'msg-0', content: 'Original message text', agent_id: 'ed' })
    render(
      <ChannelMessageComponent
        message={makeMessage({ reply_to_id: 'msg-0' })}
        replyToMessage={replyTo}
      />
    )
    expect(screen.getByText(/Original message text/)).toBeInTheDocument()
  })

  it('does not show reply context when replyToMessage is null', () => {
    render(<ChannelMessageComponent message={makeMessage()} replyToMessage={null} />)
    expect(screen.queryByTestId('reply-context')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Forwarded badge
  // -------------------------------------------------------------------------

  it('shows forwarded badge when forwardedFromMessage is provided', () => {
    const forwarded = makeMessage({ id: 'msg-orig', content: 'forwarded content' })
    render(
      <ChannelMessageComponent
        message={makeMessage({ forwarded_from: 'msg-orig' })}
        forwardedFromMessage={forwarded}
      />
    )
    expect(screen.getByText(/forwarded/i)).toBeInTheDocument()
  })

  it('does not show forwarded badge when forwardedFromMessage is null', () => {
    render(<ChannelMessageComponent message={makeMessage()} forwardedFromMessage={null} />)
    expect(screen.queryByText(/forwarded/i)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Thread count
  // -------------------------------------------------------------------------

  it('shows thread count badge when thread_count > 0', () => {
    render(<ChannelMessageComponent message={makeMessage({ thread_count: 5 })} />)
    expect(screen.getByText(/5/)).toBeInTheDocument()
  })

  it('does not show thread badge when thread_count is 0', () => {
    render(<ChannelMessageComponent message={makeMessage({ thread_count: 0 })} />)
    expect(screen.queryByTestId('thread-badge')).not.toBeInTheDocument()
  })

  it('clicking thread badge calls onThread', async () => {
    const user = userEvent.setup()
    const msg = makeMessage({ thread_count: 3 })
    const onThread = vi.fn()
    render(<ChannelMessageComponent message={msg} onThread={onThread} />)
    await user.click(screen.getByTestId('thread-badge'))
    expect(onThread).toHaveBeenCalledWith(msg)
  })

  // -------------------------------------------------------------------------
  // Hover action bar
  // -------------------------------------------------------------------------

  it('shows action bar on hover', async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    render(
      <ChannelMessageComponent message={makeMessage()} onReply={onReply} />
    )
    const wrapper = screen.getByTestId('channel-message')
    await user.hover(wrapper)
    expect(screen.getByTitle('Reply')).toBeInTheDocument()
  })

  it('hides action bar when not hovered', () => {
    render(
      <ChannelMessageComponent
        message={makeMessage()}
        onReply={vi.fn()}
      />
    )
    expect(screen.queryByTitle('Reply')).not.toBeInTheDocument()
  })

  it('reply button calls onReply with message', () => {
    const msg = makeMessage()
    const onReply = vi.fn()
    render(<ChannelMessageComponent message={msg} onReply={onReply} />)
    fireEvent.mouseEnter(screen.getByTestId('channel-message'))
    fireEvent.click(screen.getByTitle('Reply'))
    expect(onReply).toHaveBeenCalledWith(msg)
  })

  it('forward button calls onForward with message', () => {
    const msg = makeMessage()
    const onForward = vi.fn()
    render(<ChannelMessageComponent message={msg} onForward={onForward} />)
    fireEvent.mouseEnter(screen.getByTestId('channel-message'))
    fireEvent.click(screen.getByTitle('Forward'))
    expect(onForward).toHaveBeenCalledWith(msg)
  })

  it('thread button calls onThread with message', () => {
    const msg = makeMessage()
    const onThread = vi.fn()
    render(<ChannelMessageComponent message={msg} onThread={onThread} />)
    fireEvent.mouseEnter(screen.getByTestId('channel-message'))
    fireEvent.click(screen.getByTitle('Start thread'))
    expect(onThread).toHaveBeenCalledWith(msg)
  })

  it('does not render reply button when onReply is not provided', async () => {
    const user = userEvent.setup()
    render(<ChannelMessageComponent message={makeMessage()} onForward={vi.fn()} />)
    await user.hover(screen.getByTestId('channel-message'))
    expect(screen.queryByTitle('Reply')).not.toBeInTheDocument()
  })

  it('does not render forward button when onForward is not provided', async () => {
    const user = userEvent.setup()
    render(<ChannelMessageComponent message={makeMessage()} onReply={vi.fn()} />)
    await user.hover(screen.getByTestId('channel-message'))
    expect(screen.queryByTitle('Forward')).not.toBeInTheDocument()
  })
})
