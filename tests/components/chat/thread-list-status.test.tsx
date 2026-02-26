import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ThreadList, type ThreadSummary } from '@/components/chat/thread-list'

const baseThread: ThreadSummary = {
  id: 'thread-1',
  title: 'Test Thread',
  last_message: 'Hello world',
  last_message_at: new Date().toISOString(),
  agent_id: 'cc',
}

describe('ThreadList agent status indicators', () => {
  it('renders emerald status dot for online agents', () => {
    const { container } = render(
      <ThreadList
        threads={[baseThread]}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
        agentStatuses={{ cc: 'online' }}
      />
    )

    const dot = container.querySelector('[data-testid="agent-status-dot"]')
    expect(dot).toBeTruthy()
    expect(dot?.classList.contains('bg-emerald-500')).toBe(true)
  })

  it('renders amber pulsing dot for busy agents', () => {
    const { container } = render(
      <ThreadList
        threads={[baseThread]}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
        agentStatuses={{ cc: 'busy' }}
      />
    )

    const dot = container.querySelector('[data-testid="agent-status-dot"]')
    expect(dot).toBeTruthy()
    expect(dot?.classList.contains('bg-amber-500')).toBe(true)
    expect(dot?.classList.contains('animate-pulse')).toBe(true)
  })

  it('renders blue dot for idle agents', () => {
    const { container } = render(
      <ThreadList
        threads={[baseThread]}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
        agentStatuses={{ cc: 'idle' }}
      />
    )

    const dot = container.querySelector('[data-testid="agent-status-dot"]')
    expect(dot).toBeTruthy()
    expect(dot?.classList.contains('bg-blue-500')).toBe(true)
  })

  it('renders gray dot for offline agents', () => {
    const { container } = render(
      <ThreadList
        threads={[baseThread]}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
        agentStatuses={{ cc: 'offline' }}
      />
    )

    const dot = container.querySelector('[data-testid="agent-status-dot"]')
    expect(dot).toBeTruthy()
    expect(dot?.classList.contains('bg-gray-500')).toBe(true)
  })

  it('does not render status dot when agentStatuses is not provided', () => {
    const { container } = render(
      <ThreadList
        threads={[baseThread]}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
      />
    )

    const dot = container.querySelector('[data-testid="agent-status-dot"]')
    expect(dot).toBeNull()
  })

  it('does not render status dot when thread has no agent_id', () => {
    const noAgentThread: ThreadSummary = {
      ...baseThread,
      id: 'no-agent',
      agent_id: null,
    }

    const { container } = render(
      <ThreadList
        threads={[noAgentThread]}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
        agentStatuses={{ cc: 'online' }}
      />
    )

    const dot = container.querySelector('[data-testid="agent-status-dot"]')
    expect(dot).toBeNull()
  })

  it('does not render status dot when agent_id has no status entry', () => {
    const { container } = render(
      <ThreadList
        threads={[baseThread]}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
        agentStatuses={{ pip: 'online' }}
      />
    )

    const dot = container.querySelector('[data-testid="agent-status-dot"]')
    expect(dot).toBeNull()
  })

  it('renders correct status dots for multiple threads with different agents', () => {
    const threads: ThreadSummary[] = [
      { ...baseThread, id: 't1', agent_id: 'cc' },
      { ...baseThread, id: 't2', agent_id: 'pip' },
      { ...baseThread, id: 't3', agent_id: 'ed' },
      { ...baseThread, id: 't4', agent_id: null },
    ]

    const { container } = render(
      <ThreadList
        threads={threads}
        activeThreadId={null}
        onSelectThread={() => {}}
        onNewThread={() => {}}
        agentStatuses={{
          cc: 'online',
          pip: 'busy',
          ed: 'offline',
        }}
      />
    )

    const dots = container.querySelectorAll('[data-testid="agent-status-dot"]')
    expect(dots.length).toBe(3) // t4 has no agent_id, so no dot

    // Verify each dot has the right color class
    expect(dots[0]?.classList.contains('bg-emerald-500')).toBe(true) // cc: online
    expect(dots[1]?.classList.contains('bg-amber-500')).toBe(true)   // pip: busy
    expect(dots[2]?.classList.contains('bg-gray-500')).toBe(true)    // ed: offline
  })
})
