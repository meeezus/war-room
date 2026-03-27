import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PlanChat } from '@/components/plan-chat'

// ---------------------------------------------------------------------------
// Plan Chat Component Tests
//
// Tests the client-side chat UI:
// 1. Renders initial history
// 2. Input handling (send, shift+enter, disable when empty)
// 3. Sends message to API
// 4. Handles streaming response
// 5. Handles JSON fallback response
// 6. Shows thinking state
// ---------------------------------------------------------------------------

// jsdom doesn't have scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

describe('PlanChat', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders empty state message when no history', () => {
    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    expect(screen.getByText(/Chat about this plan/)).toBeInTheDocument()
  })

  it('renders initial chat history', () => {
    const history = [
      { role: 'user' as const, content: 'Hello', timestamp: '2026-03-27T01:00:00Z' },
      { role: 'assistant' as const, content: 'Hi there', timestamp: '2026-03-27T01:01:00Z' },
    ]
    render(<PlanChat planId="plan-123" initialHistory={history} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there')).toBeInTheDocument()
  })

  it('has a textarea input and send button', () => {
    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    expect(screen.getByPlaceholderText(/Iterate on this plan/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    const btn = screen.getByRole('button', { name: /send/i })
    expect(btn).toBeDisabled()
  })

  it('send button is enabled when input has text', () => {
    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    const textarea = screen.getByPlaceholderText(/Iterate on this plan/)
    fireEvent.change(textarea, { target: { value: 'test message' } })
    const btn = screen.getByRole('button', { name: /send/i })
    expect(btn).not.toBeDisabled()
  })

  it('sends message on Enter key press', async () => {
    fetchMock.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: 'queued', message: 'Processing' }),
    })

    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    const textarea = screen.getByPlaceholderText(/Iterate on this plan/)
    fireEvent.change(textarea, { target: { value: 'my message' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/plans/plan-123/chat',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: 'my message' }),
        })
      )
    })
  })

  it('does NOT send on Shift+Enter (allows newline)', () => {
    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    const textarea = screen.getByPlaceholderText(/Iterate on this plan/)
    fireEvent.change(textarea, { target: { value: 'my message' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows user message immediately after sending', async () => {
    fetchMock.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: 'queued', message: 'Processing...' }),
    })

    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    const textarea = screen.getByPlaceholderText(/Iterate on this plan/)
    fireEvent.change(textarea, { target: { value: 'quick question' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText('quick question')).toBeInTheDocument()
    })
  })

  it('clears input after sending', async () => {
    fetchMock.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: 'queued', message: 'Processing...' }),
    })

    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    const textarea = screen.getByPlaceholderText(/Iterate on this plan/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'will be cleared' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(textarea.value).toBe('')
    })
  })

  it('shows Thinking indicator while waiting for response', async () => {
    // Create a promise that won't resolve immediately
    let resolveResponse: (v: unknown) => void
    const responsePromise = new Promise((resolve) => { resolveResponse = resolve })
    fetchMock.mockReturnValueOnce(responsePromise)

    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    const textarea = screen.getByPlaceholderText(/Iterate on this plan/)
    fireEvent.change(textarea, { target: { value: 'thinking test' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText('Thinking...')).toBeInTheDocument()
    })

    // Resolve to avoid unhandled promise
    resolveResponse!({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'done' }),
    })
  })

  it('handles JSON fallback response (Vercel mode)', async () => {
    fetchMock.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: 'queued', message: 'Processing via poller' }),
    })

    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    const textarea = screen.getByPlaceholderText(/Iterate on this plan/)
    fireEvent.change(textarea, { target: { value: 'vercel test' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText(/Processing via poller/)).toBeInTheDocument()
    })
  })

  it('shows error message on fetch failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'))

    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    const textarea = screen.getByPlaceholderText(/Iterate on this plan/)
    fireEvent.change(textarea, { target: { value: 'error test' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText(/Error/)).toBeInTheDocument()
    })
  })

  it('disables send button while streaming', async () => {
    let resolveResponse: (v: unknown) => void
    const responsePromise = new Promise((resolve) => { resolveResponse = resolve })
    fetchMock.mockReturnValueOnce(responsePromise)

    render(<PlanChat planId="plan-123" initialHistory={[]} />)
    const textarea = screen.getByPlaceholderText(/Iterate on this plan/)
    fireEvent.change(textarea, { target: { value: 'disable test' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    })

    // Resolve to avoid unhandled promise
    resolveResponse!({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'done' }),
    })
  })
})
