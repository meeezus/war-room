import { describe, it, expect } from 'vitest'

/**
 * Unit tests for the Makima pulse indicator logic in ChatPage.
 *
 * The component derives two values:
 *   const activeAgent = threads.find(t => t.id === activeThreadId)?.agent_id
 *   const isMakima = activeAgent === 'makima'
 *
 * The pulse indicator renders when isMakima && activeThreadId is truthy.
 *
 * We extract and test the detection logic here without rendering the full
 * ChatPage component (which requires heavy Supabase/fetch mocking).
 */

interface ThreadStub {
  id: string
  agent_id: string | null
}

function detectMakima(threads: ThreadStub[], activeThreadId: string | null) {
  const activeAgent = threads.find(t => t.id === activeThreadId)?.agent_id
  const isMakima = activeAgent === 'makima'
  return { activeAgent, isMakima }
}

function shouldShowPulse(threads: ThreadStub[], activeThreadId: string | null) {
  const { isMakima } = detectMakima(threads, activeThreadId)
  return isMakima && !!activeThreadId
}

describe('Makima pulse indicator detection', () => {
  const threads: ThreadStub[] = [
    { id: 'thread-1', agent_id: 'makima' },
    { id: 'thread-2', agent_id: 'cc' },
    { id: 'thread-3', agent_id: 'ed' },
    { id: 'thread-4', agent_id: null },
  ]

  describe('detectMakima', () => {
    it('returns isMakima=true for a Makima thread', () => {
      const result = detectMakima(threads, 'thread-1')
      expect(result.activeAgent).toBe('makima')
      expect(result.isMakima).toBe(true)
    })

    it('returns isMakima=false for a non-Makima thread', () => {
      const result = detectMakima(threads, 'thread-2')
      expect(result.activeAgent).toBe('cc')
      expect(result.isMakima).toBe(false)
    })

    it('returns isMakima=false when activeThreadId is null', () => {
      const result = detectMakima(threads, null)
      expect(result.activeAgent).toBeUndefined()
      expect(result.isMakima).toBe(false)
    })

    it('returns isMakima=false for thread with null agent_id', () => {
      const result = detectMakima(threads, 'thread-4')
      expect(result.activeAgent).toBeNull()
      expect(result.isMakima).toBe(false)
    })

    it('returns isMakima=false for non-existent thread id', () => {
      const result = detectMakima(threads, 'thread-999')
      expect(result.activeAgent).toBeUndefined()
      expect(result.isMakima).toBe(false)
    })
  })

  describe('shouldShowPulse', () => {
    it('shows pulse for active Makima thread', () => {
      expect(shouldShowPulse(threads, 'thread-1')).toBe(true)
    })

    it('does not show pulse for non-Makima thread', () => {
      expect(shouldShowPulse(threads, 'thread-2')).toBe(false)
    })

    it('does not show pulse when no thread is active', () => {
      expect(shouldShowPulse(threads, null)).toBe(false)
    })

    it('does not show pulse for thread with null agent_id', () => {
      expect(shouldShowPulse(threads, 'thread-4')).toBe(false)
    })

    it('does not show pulse for non-existent thread', () => {
      expect(shouldShowPulse(threads, 'thread-999')).toBe(false)
    })
  })
})
