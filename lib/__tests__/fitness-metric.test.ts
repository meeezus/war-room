// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock fs/promises before imports
// ---------------------------------------------------------------------------
const { mockReaddir, mockReadFile, mockStat } = vi.hoisted(() => {
  return {
    mockReaddir: vi.fn(),
    mockReadFile: vi.fn(),
    mockStat: vi.fn(),
  }
})

vi.mock(import('fs/promises'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: actual,
    readdir: mockReaddir,
    readFile: mockReadFile,
    stat: mockStat,
  }
})

import { computeFitness, validatePatch } from '@/lib/fitness-metric'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAutopsy(overrides: Partial<{
  session_id: string
  timestamp: string
  total_predictions: number
  matches: number
  partials: number
  misses: number
  miss_rate: number
  patterns: unknown[]
  candidate_patches: unknown[]
}> = {}) {
  return JSON.stringify({
    session_id: overrides.session_id ?? 'test-session',
    timestamp: overrides.timestamp ?? '2026-03-25T12:00:00Z',
    total_predictions: overrides.total_predictions ?? 10,
    matches: overrides.matches ?? 8,
    partials: overrides.partials ?? 0,
    misses: overrides.misses ?? 2,
    miss_rate: overrides.miss_rate ?? 0.2,
    patterns: overrides.patterns ?? [],
    candidate_patches: overrides.candidate_patches ?? [],
  })
}

/** Generate a date string N days ago in YYYY-MM-DDTHHMMSS format (filename format) */
function daysAgoFilename(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const iso = d.toISOString() // 2026-03-20T12:00:00.000Z
  const yyyy = iso.slice(0, 4)
  const mm = iso.slice(5, 7)
  const dd = iso.slice(8, 10)
  const hh = iso.slice(11, 13)
  const mi = iso.slice(14, 16)
  const ss = iso.slice(17, 19)
  return `${yyyy}-${mm}-${dd}T${hh}${mi}${ss}`
}

// ---------------------------------------------------------------------------
// Tests: computeFitness
// ---------------------------------------------------------------------------

describe('computeFitness', () => {
  beforeEach(() => {
    mockReaddir.mockReset()
    mockReadFile.mockReset()
    mockStat.mockReset()
  })

  it('returns null when autopsies directory does not exist', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result).toBeNull()
  })

  it('returns null when autopsies directory is empty', async () => {
    mockReaddir.mockResolvedValue([])

    const result = await computeFitness()
    expect(result).toBeNull()
  })

  it('computes fitness from current 7d sessions', async () => {
    const file1 = `${daysAgoFilename(1)}.json`
    const file2 = `${daysAgoFilename(2)}.json`
    const file3 = `${daysAgoFilename(3)}.json`

    mockReaddir.mockResolvedValue([file1, file2, file3])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(file1)) return makeAutopsy({ miss_rate: 0.1, misses: 1 })
      if (path.includes(file2)) return makeAutopsy({ miss_rate: 0.2, misses: 2 })
      if (path.includes(file3)) return makeAutopsy({ miss_rate: 0.3, misses: 3 })
      throw new Error('ENOENT')
    })

    // No candidate patches
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result).not.toBeNull()
    expect(result!.sessions).toBe(3)
    expect(result!.corrections).toBe(6) // 1+2+3
    // Average miss rate: (0.1+0.2+0.3)/3 = 0.2
    expect(result!.missRate).toBeCloseTo(0.2, 3)
    expect(result!.computedAt).toBeTruthy()
  })

  it('computes trend as improving when current miss rate < previous by >0.02', async () => {
    // Current period (0-7 days ago): low miss rate
    const current1 = `${daysAgoFilename(1)}.json`
    const current2 = `${daysAgoFilename(2)}.json`
    // Previous period (7-14 days ago): high miss rate
    const prev1 = `${daysAgoFilename(8)}.json`
    const prev2 = `${daysAgoFilename(9)}.json`

    mockReaddir.mockResolvedValue([current1, current2, prev1, prev2])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(current1)) return makeAutopsy({ miss_rate: 0.05, misses: 1 })
      if (path.includes(current2)) return makeAutopsy({ miss_rate: 0.05, misses: 1 })
      if (path.includes(prev1)) return makeAutopsy({ miss_rate: 0.3, misses: 5 })
      if (path.includes(prev2)) return makeAutopsy({ miss_rate: 0.3, misses: 5 })
      throw new Error('ENOENT')
    })
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result).not.toBeNull()
    expect(result!.missRateTrend).toBe('improving')
    expect(result!.corrections).toBe(2)
    expect(result!.correctionsPrevPeriod).toBe(10)
  })

  it('computes trend as degrading when current miss rate > previous by >0.02', async () => {
    const current1 = `${daysAgoFilename(1)}.json`
    const prev1 = `${daysAgoFilename(8)}.json`

    mockReaddir.mockResolvedValue([current1, prev1])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(current1)) return makeAutopsy({ miss_rate: 0.4, misses: 8 })
      if (path.includes(prev1)) return makeAutopsy({ miss_rate: 0.1, misses: 1 })
      throw new Error('ENOENT')
    })
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result!.missRateTrend).toBe('degrading')
  })

  it('computes trend as stable when difference <= 0.02', async () => {
    const current1 = `${daysAgoFilename(1)}.json`
    const prev1 = `${daysAgoFilename(8)}.json`

    mockReaddir.mockResolvedValue([current1, prev1])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(current1)) return makeAutopsy({ miss_rate: 0.21, misses: 2 })
      if (path.includes(prev1)) return makeAutopsy({ miss_rate: 0.20, misses: 2 })
      throw new Error('ENOENT')
    })
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result!.missRateTrend).toBe('stable')
  })

  it('sets trend to stable when no previous period data', async () => {
    const current1 = `${daysAgoFilename(1)}.json`

    mockReaddir.mockResolvedValue([current1])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(current1)) return makeAutopsy({ miss_rate: 0.15, misses: 3 })
      throw new Error('ENOENT')
    })
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result!.missRateTrend).toBe('stable')
    expect(result!.correctionsPrevPeriod).toBe(0)
  })

  it('skips malformed JSON files gracefully', async () => {
    const good = `${daysAgoFilename(1)}.json`
    const bad = `${daysAgoFilename(2)}.json`

    mockReaddir.mockResolvedValue([good, bad])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(good)) return makeAutopsy({ miss_rate: 0.1, misses: 1 })
      if (path.includes(bad)) return '{ broken json'
      throw new Error('ENOENT')
    })
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result).not.toBeNull()
    expect(result!.sessions).toBe(1)
    expect(result!.corrections).toBe(1)
  })

  it('skips non-JSON files', async () => {
    const good = `${daysAgoFilename(1)}.json`

    mockReaddir.mockResolvedValue([good, 'README.md', '.DS_Store'])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(good)) return makeAutopsy({ miss_rate: 0.1, misses: 1 })
      throw new Error('ENOENT')
    })
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result!.sessions).toBe(1)
  })

  it('skips files older than 14 days', async () => {
    const recent = `${daysAgoFilename(1)}.json`
    const old = `${daysAgoFilename(20)}.json`

    mockReaddir.mockResolvedValue([recent, old])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(recent)) return makeAutopsy({ miss_rate: 0.1, misses: 1 })
      if (path.includes(old)) return makeAutopsy({ miss_rate: 0.9, misses: 9 })
      throw new Error('ENOENT')
    })
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result!.sessions).toBe(1)
    expect(result!.corrections).toBe(1)
    expect(result!.correctionsPrevPeriod).toBe(0)
  })

  it('counts candidate patches from current 7d using stat mtime', async () => {
    const file1 = `${daysAgoFilename(1)}.json`

    mockReaddir.mockImplementation(async (dirPath: string) => {
      if (String(dirPath).includes('session_autopsies')) return [file1]
      if (String(dirPath).includes('candidate_patches')) return ['patch1.md', 'patch2.md', 'old-patch.md']
      return []
    })
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(file1)) return makeAutopsy({ miss_rate: 0.1, misses: 1 })
      throw new Error('ENOENT')
    })

    const now = Date.now()
    mockStat.mockImplementation(async (path: string) => {
      if (path.includes('patch1.md')) return { mtimeMs: now - 1000 * 60 * 60 * 24 * 1 } // 1 day ago
      if (path.includes('patch2.md')) return { mtimeMs: now - 1000 * 60 * 60 * 24 * 2 } // 2 days ago
      if (path.includes('old-patch.md')) return { mtimeMs: now - 1000 * 60 * 60 * 24 * 20 } // 20 days ago
      throw new Error('ENOENT')
    })

    const result = await computeFitness()
    expect(result!.skillsImproved).toBe(2)
  })

  it('notes insufficient data in digest when fewer than 5 current sessions', async () => {
    const file1 = `${daysAgoFilename(1)}.json`

    mockReaddir.mockResolvedValue([file1])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(file1)) return makeAutopsy({ miss_rate: 0.1, misses: 1 })
      throw new Error('ENOENT')
    })
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result).not.toBeNull()
    expect(result!.digest).toContain('1 session')
    // Should still compute (just note in digest)
    expect(result!.missRate).toBeCloseTo(0.1, 3)
  })

  it('produces a readable digest string', async () => {
    const file1 = `${daysAgoFilename(1)}.json`
    const file2 = `${daysAgoFilename(2)}.json`
    const prev1 = `${daysAgoFilename(8)}.json`

    mockReaddir.mockResolvedValue([file1, file2, prev1])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(file1)) return makeAutopsy({ miss_rate: 0.1, misses: 1 })
      if (path.includes(file2)) return makeAutopsy({ miss_rate: 0.2, misses: 2 })
      if (path.includes(prev1)) return makeAutopsy({ miss_rate: 0.3, misses: 5 })
      throw new Error('ENOENT')
    })
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result!.digest).toContain('2 sessions')
    expect(result!.digest).toContain('3 corrections')
    // Should mention previous period since there is one
    expect(result!.digest).toContain('down from 5')
  })

  it('handles readFile throwing for individual files', async () => {
    const good = `${daysAgoFilename(1)}.json`
    const bad = `${daysAgoFilename(2)}.json`

    mockReaddir.mockResolvedValue([good, bad])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes(good)) return makeAutopsy({ miss_rate: 0.1, misses: 1 })
      if (path.includes(bad)) throw new Error('EACCES')
      throw new Error('ENOENT')
    })
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await computeFitness()
    expect(result!.sessions).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Tests: validatePatch
// ---------------------------------------------------------------------------

describe('validatePatch', () => {
  it('always returns approved: false (stub)', () => {
    const result = validatePatch({ id: 'patch-1', content: 'some content' })
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('manual review')
    expect(result.replayResults).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Tests: API route /api/fitness/weekly
// ---------------------------------------------------------------------------

describe('GET /api/fitness/weekly', () => {
  let mockComputeFitness: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockComputeFitness = vi.fn()
    vi.resetModules()
  })

  it('returns isLocal: false on Vercel', async () => {
    const originalVercel = process.env.VERCEL
    process.env.VERCEL = '1'

    // Dynamic import the route handler after setting env
    vi.doMock('@/lib/fitness-metric', () => ({
      computeFitness: mockComputeFitness,
    }))
    vi.doMock('fs/promises', () => ({
      readFile: vi.fn().mockRejectedValue(new Error('no')),
    }))

    const { GET } = await import('@/app/api/fitness/weekly/route')
    const response = await GET()
    const body = await response.json()

    expect(body.isLocal).toBe(false)
    expect(body.fitness).toBeNull()

    // Restore
    if (originalVercel === undefined) {
      delete process.env.VERCEL
    } else {
      process.env.VERCEL = originalVercel
    }
  })

  it('returns pre-computed data when system_fitness.json exists', async () => {
    delete process.env.VERCEL

    const precomputed = JSON.stringify({
      computed_at: '2026-03-25T12:00:00Z',
      miss_rate: 0.15,
      miss_rate_trend: 'improving',
      corrections: 5,
      corrections_prev_period: 10,
      skills_improved: 2,
      sessions: 8,
      digest: '8 sessions, 5 corrections (down from 10), 2 skills improved',
    })

    vi.doMock('fs/promises', () => ({
      readFile: vi.fn().mockResolvedValue(precomputed),
    }))
    vi.doMock('@/lib/fitness-metric', () => ({
      computeFitness: mockComputeFitness,
    }))

    const { GET } = await import('@/app/api/fitness/weekly/route')
    const response = await GET()
    const body = await response.json()

    expect(body.isLocal).toBe(true)
    expect(body.fitness).not.toBeNull()
    // Verify snake_case -> camelCase mapping
    expect(body.fitness.missRate).toBe(0.15)
    expect(body.fitness.missRateTrend).toBe('improving')
    expect(body.fitness.corrections).toBe(5)
    expect(body.fitness.correctionsPrevPeriod).toBe(10)
    expect(body.fitness.skillsImproved).toBe(2)
    expect(body.fitness.sessions).toBe(8)
    expect(body.fitness.computedAt).toBe('2026-03-25T12:00:00Z')
  })

  it('falls back to computeFitness when no pre-computed file', async () => {
    delete process.env.VERCEL

    vi.doMock('fs/promises', () => ({
      readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    }))
    vi.doMock('@/lib/fitness-metric', () => ({
      computeFitness: vi.fn().mockResolvedValue({
        missRate: 0.2,
        missRateTrend: 'stable',
        corrections: 3,
        correctionsPrevPeriod: 0,
        skillsImproved: 0,
        sessions: 2,
        digest: '2 sessions, 3 corrections, 0 skills improved',
        computedAt: '2026-03-25T12:00:00Z',
      }),
    }))

    const { GET } = await import('@/app/api/fitness/weekly/route')
    const response = await GET()
    const body = await response.json()

    expect(body.isLocal).toBe(true)
    expect(body.fitness).not.toBeNull()
    expect(body.fitness.missRate).toBe(0.2)
    expect(body.fitness.sessions).toBe(2)
  })

  it('returns 500 with null fitness when everything fails', async () => {
    delete process.env.VERCEL

    vi.doMock('fs/promises', () => ({
      readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    }))
    vi.doMock('@/lib/fitness-metric', () => ({
      computeFitness: vi.fn().mockRejectedValue(new Error('catastrophic')),
    }))

    const { GET } = await import('@/app/api/fitness/weekly/route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.fitness).toBeNull()
    expect(body.error).toBeTruthy()
  })
})
