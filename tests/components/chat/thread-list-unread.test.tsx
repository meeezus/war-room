import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThreadList, type ThreadSummary } from '@/components/chat/thread-list'

const baseThread: ThreadSummary = {
  id: 'thread-1',
  title: 'Test Thread',
  last_message: 'Hello world',
  last_message_at: new Date().toISOString(),
  agent_id: null,
}

describe('ThreadList unread badges', () => {
  it('renders emerald dot for unread threads', () => {
    const unreadThread: ThreadSummary = {
      ...baseThread,
      id: 'unread-1',
      title: 'Unread Thread',
      unread: true,
    }

    const { container } = render(
      <ThreadList
        threads={[unreadThread]}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
      />
    )

    // Should render a small emerald dot
    const dot = container.querySelector('.bg-emerald-500.rounded-full.w-2.h-2')
    expect(dot).toBeTruthy()
  })

  it('does not render emerald dot for read threads', () => {
    const readThread: ThreadSummary = {
      ...baseThread,
      id: 'read-1',
      title: 'Read Thread',
      unread: false,
    }

    const { container } = render(
      <ThreadList
        threads={[readThread]}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
      />
    )

    const dot = container.querySelector('.bg-emerald-500.rounded-full.w-2.h-2')
    expect(dot).toBeNull()
  })

  it('does not render emerald dot when unread is undefined', () => {
    const { container } = render(
      <ThreadList
        threads={[baseThread]}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
      />
    )

    const dot = container.querySelector('.bg-emerald-500.rounded-full.w-2.h-2')
    expect(dot).toBeNull()
  })

  it('renders dots only for unread threads in a mixed list', () => {
    const threads: ThreadSummary[] = [
      { ...baseThread, id: 'a', title: 'Read A', unread: false },
      { ...baseThread, id: 'b', title: 'Unread B', unread: true },
      { ...baseThread, id: 'c', title: 'Unread C', unread: true },
      { ...baseThread, id: 'd', title: 'Read D' },
    ]

    const { container } = render(
      <ThreadList
        threads={threads}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
      />
    )

    const dots = container.querySelectorAll('.bg-emerald-500.rounded-full.w-2.h-2')
    expect(dots.length).toBe(2)
  })
})
