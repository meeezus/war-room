import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageArea } from '@/components/chat/message-area'

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
})

describe('Typing Indicator', () => {
  const baseProps = {
    messages: [],
    streamingContent: '',
    isLoading: false,
    isFetching: false,
    agentId: 'cc',
    isTyping: false,
  }

  it('shows typing dots when isTyping is true and no streaming content', () => {
    render(
      <MessageArea
        {...baseProps}
        messages={[
          {
            id: 'msg-1',
            thread_id: 'thread-1',
            role: 'user',
            content: 'Hello',
            agent_id: null,
            user_id: 'sensei',
            streaming: false,
            streaming_complete: true,
            metadata: {},
            created_at: new Date().toISOString(),
          },
        ]}
        isTyping={true}
        streamingContent=""
      />
    )
    const dots = screen.getByTestId('typing-indicator')
    expect(dots).toBeInTheDocument()
  })

  it('hides typing dots when streaming content arrives', () => {
    render(
      <MessageArea
        {...baseProps}
        messages={[
          {
            id: 'msg-1',
            thread_id: 'thread-1',
            role: 'user',
            content: 'Hello',
            agent_id: null,
            user_id: 'sensei',
            streaming: false,
            streaming_complete: true,
            metadata: {},
            created_at: new Date().toISOString(),
          },
        ]}
        isTyping={true}
        streamingContent="Here is my response"
      />
    )
    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
  })

  it('hides typing dots when isTyping is false', () => {
    render(
      <MessageArea
        {...baseProps}
        messages={[
          {
            id: 'msg-1',
            thread_id: 'thread-1',
            role: 'user',
            content: 'Hello',
            agent_id: null,
            user_id: 'sensei',
            streaming: false,
            streaming_complete: true,
            metadata: {},
            created_at: new Date().toISOString(),
          },
        ]}
        isTyping={false}
        streamingContent=""
      />
    )
    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
  })

  it('renders three bouncing dot elements inside the indicator', () => {
    render(
      <MessageArea
        {...baseProps}
        messages={[
          {
            id: 'msg-1',
            thread_id: 'thread-1',
            role: 'user',
            content: 'Hello',
            agent_id: null,
            user_id: 'sensei',
            streaming: false,
            streaming_complete: true,
            metadata: {},
            created_at: new Date().toISOString(),
          },
        ]}
        isTyping={true}
        streamingContent=""
      />
    )
    const indicator = screen.getByTestId('typing-indicator')
    const dots = indicator.querySelectorAll('span')
    expect(dots).toHaveLength(3)
  })
})
