import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase before importing the module
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})

const mockFrom = vi.fn().mockReturnValue({
  update: mockUpdate,
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// Set required env vars before module import
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

describe('markThreadRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-setup the mock chain after clear
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mockFrom.mockReturnValue({
      update: mockUpdate,
    })
  })

  it('should be exported from lib/chat', async () => {
    const chatModule = await import('@/lib/chat')
    expect(chatModule.markThreadRead).toBeDefined()
    expect(typeof chatModule.markThreadRead).toBe('function')
  })

  it('should update unread to false for the given thread id', async () => {
    const { markThreadRead } = await import('@/lib/chat')
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: eqMock })

    await markThreadRead('thread-abc-123')

    expect(mockFrom).toHaveBeenCalledWith('chat_threads')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ unread: false })
    )
    expect(eqMock).toHaveBeenCalledWith('id', 'thread-abc-123')
  })

  it('should include updated_at in the update payload', async () => {
    const { markThreadRead } = await import('@/lib/chat')
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: eqMock })

    await markThreadRead('thread-xyz')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        unread: false,
        updated_at: expect.any(String),
      })
    )
  })

  it('should throw on Supabase error', async () => {
    const { markThreadRead } = await import('@/lib/chat')
    const eqMock = vi.fn().mockResolvedValue({
      error: { message: 'Not found', code: '404' },
    })
    mockUpdate.mockReturnValue({ eq: eqMock })

    await expect(markThreadRead('bad-id')).rejects.toThrow()
  })
})
