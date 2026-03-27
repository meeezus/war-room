import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Research Scan Cron Tests
// ---------------------------------------------------------------------------
// Tests for the research scan logic: Brave Search integration, dedup, and
// finding insertion into research_findings table.

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock supabase-server
const mockFrom = vi.fn()
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn(),
  captureWarning: vi.fn(),
}))

// Import the module under test (will be created)
import {
  searchBrave,
  deduplicateFindings,
  insertFindings,
  runResearchScan,
  RESEARCH_TOPICS,
} from '@/lib/research-scan'

describe('RESEARCH_TOPICS', () => {
  it('contains at least 3 search topics', () => {
    expect(RESEARCH_TOPICS.length).toBeGreaterThanOrEqual(3)
  })

  it('topics are non-empty strings', () => {
    for (const topic of RESEARCH_TOPICS) {
      expect(typeof topic).toBe('string')
      expect(topic.length).toBeGreaterThan(0)
    }
  })
})

describe('searchBrave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns empty array when BRAVE_API_KEY is missing', async () => {
    vi.stubEnv('BRAVE_API_KEY', '')
    const results = await searchBrave('test query')
    expect(results).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calls Brave API with correct URL and headers', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key-123')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    })

    await searchBrave('AI agents 2026')
    expect(mockFetch).toHaveBeenCalledOnce()

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('https://api.search.brave.com/res/v1/web/search')
    expect(url).toContain('q=AI%20agents%202026')
    expect(url).toContain('count=5')
    expect(url).toContain('freshness=pw')
    expect(opts.headers['X-Subscription-Token']).toBe('test-key-123')
    expect(opts.headers['Accept']).toBe('application/json')
  })

  it('maps Brave results to research finding format', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key-123')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              title: 'Claude Code gets autonomous mode',
              description: 'Anthropic releases new coding agent features',
              url: 'https://example.com/article1',
              age: '2d',
            },
            {
              title: 'MCP protocol update v2',
              description: 'Model Context Protocol gets major update',
              url: 'https://example.com/article2',
              age: '1d',
            },
          ],
        },
      }),
    })

    const results = await searchBrave('Claude Code')
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      source: 'brave',
      title: 'Claude Code gets autonomous mode',
      summary: 'Anthropic releases new coding agent features',
      url: 'https://example.com/article1',
      relevance: 'medium',
      tags: expect.arrayContaining([expect.any(String)]),
      metadata: { query: 'Claude Code', age: '2d' },
    })
  })

  it('returns empty array on fetch failure', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key-123')
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
    })

    const results = await searchBrave('test query')
    expect(results).toEqual([])
  })

  it('returns empty array on network error', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key-123')
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const results = await searchBrave('test query')
    expect(results).toEqual([])
  })

  it('handles missing web.results gracefully', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key-123')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ web: {} }),
    })

    const results = await searchBrave('test')
    expect(results).toEqual([])
  })
})

describe('deduplicateFindings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters out findings whose URL already exists in the table', async () => {
    const findings = [
      { source: 'brave', title: 'Existing', url: 'https://dupe.com', summary: '', relevance: 'medium', tags: [], metadata: {} },
      { source: 'brave', title: 'New One', url: 'https://new.com', summary: '', relevance: 'medium', tags: [], metadata: {} },
    ]

    // Mock: first URL exists (count=1), second does not (count=0)
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: (_col: string, url: string) => {
          if (url === 'https://dupe.com') return Promise.resolve({ count: 1, error: null })
          return Promise.resolve({ count: 0, error: null })
        },
      }),
    }))

    const result = await deduplicateFindings(findings)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('New One')
  })

  it('returns all findings when none are duplicates', async () => {
    const findings = [
      { source: 'brave', title: 'A', url: 'https://a.com', summary: '', relevance: 'medium', tags: [], metadata: {} },
      { source: 'brave', title: 'B', url: 'https://b.com', summary: '', relevance: 'medium', tags: [], metadata: {} },
    ]

    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => Promise.resolve({ count: 0, error: null }),
      }),
    }))

    const result = await deduplicateFindings(findings)
    expect(result).toHaveLength(2)
  })

  it('keeps findings with null URL (no dedup possible)', async () => {
    const findings = [
      { source: 'brave', title: 'No URL', url: null, summary: '', relevance: 'medium', tags: [], metadata: {} },
    ]

    const result = await deduplicateFindings(findings)
    expect(result).toHaveLength(1)
  })

  it('deduplicates within the batch itself (same URL)', async () => {
    const findings = [
      { source: 'brave', title: 'First', url: 'https://same.com', summary: '', relevance: 'medium', tags: [], metadata: {} },
      { source: 'brave', title: 'Second', url: 'https://same.com', summary: '', relevance: 'medium', tags: [], metadata: {} },
    ]

    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => Promise.resolve({ count: 0, error: null }),
      }),
    }))

    const result = await deduplicateFindings(findings)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('First')
  })
})

describe('insertFindings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts findings into research_findings table', async () => {
    const findings = [
      { source: 'brave', title: 'Test', url: 'https://test.com', summary: 'desc', relevance: 'medium', tags: ['ai'], metadata: {} },
    ]

    mockFrom.mockReturnValue({
      insert: mockInsert,
    })
    mockInsert.mockResolvedValueOnce({ error: null, count: 1 })

    const count = await insertFindings(findings)
    expect(count).toBe(1)
    expect(mockFrom).toHaveBeenCalledWith('research_findings')
    expect(mockInsert).toHaveBeenCalledWith(findings)
  })

  it('returns 0 when insertion fails', async () => {
    const findings = [
      { source: 'brave', title: 'Test', url: 'https://test.com', summary: 'desc', relevance: 'medium', tags: [], metadata: {} },
    ]

    mockFrom.mockReturnValue({
      insert: mockInsert,
    })
    mockInsert.mockResolvedValueOnce({ error: { message: 'insert failed' }, count: 0 })

    const count = await insertFindings(findings)
    expect(count).toBe(0)
  })

  it('returns 0 for empty findings array', async () => {
    const count = await insertFindings([])
    expect(count).toBe(0)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('runResearchScan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('BRAVE_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a summary with inserted count and topic count', async () => {
    // Mock all Brave searches to return 1 result each
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: 'Result', description: 'Desc', url: 'https://unique.com', age: '1d' },
          ],
        },
      }),
    })

    // Dedup: all new
    mockFrom.mockImplementation((table: string) => {
      if (table === 'research_findings') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ count: 0, error: null }),
          }),
          insert: () => Promise.resolve({ error: null, count: 1 }),
        }
      }
      // war_room_events
      return {
        insert: () => Promise.resolve({ error: null }),
      }
    })

    const result = await runResearchScan()
    expect(result).toHaveProperty('inserted')
    expect(result).toHaveProperty('topicsSearched')
    expect(result.topicsSearched).toBe(RESEARCH_TOPICS.length)
    expect(typeof result.inserted).toBe('number')
  })

  it('emits a war_room_events entry when findings are inserted', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        web: { results: [{ title: 'X', description: 'Y', url: 'https://x.com', age: '1d' }] },
      }),
    })

    const eventInsert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'research_findings') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ count: 0, error: null }),
          }),
          insert: () => Promise.resolve({ error: null, count: 1 }),
        }
      }
      if (table === 'war_room_events') {
        return { insert: eventInsert }
      }
      return {}
    })

    await runResearchScan()
    expect(eventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'research_scan_complete',
      })
    )
  })

  it('does not emit event when no findings inserted', async () => {
    // All searches return empty
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    })

    const eventInsert = vi.fn()

    mockFrom.mockImplementation((table: string) => {
      if (table === 'war_room_events') {
        return { insert: eventInsert }
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ count: 0, error: null }),
        }),
        insert: () => Promise.resolve({ error: null, count: 0 }),
      }
    })

    const result = await runResearchScan()
    expect(result.inserted).toBe(0)
    expect(eventInsert).not.toHaveBeenCalled()
  })
})
