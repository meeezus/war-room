import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// CodexBar Helper Tests
// ---------------------------------------------------------------------------
// Tests for lib/codexbar.ts
// Covers: ENOENT, permission errors, invalid JSON, valid data

const mockReadFile = vi.hoisted(() => vi.fn())

vi.mock('fs/promises', () => ({
  __esModule: true,
  default: { readFile: mockReadFile },
  readFile: mockReadFile,
}))

vi.mock('path', () => ({
  __esModule: true,
  default: {
    join: (...parts: string[]) => parts.join('/'),
  },
  join: (...parts: string[]) => parts.join('/'),
}))

vi.mock('os', () => ({
  __esModule: true,
  default: { homedir: () => '/home/testuser' },
  homedir: () => '/home/testuser',
}))

import { readCodexBarSnapshot, getCodexBarPath } from '@/lib/codexbar'

describe('getCodexBarPath', () => {
  it('builds path from homedir', () => {
    const p = getCodexBarPath()
    expect(p).toContain('Group Containers')
    expect(p).toContain('group.com.steipete.codexbar')
    expect(p).toContain('widget-snapshot.json')
  })
})

describe('readCodexBarSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error + empty providers when file not found (ENOENT)', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockReadFile.mockRejectedValueOnce(err)

    const result = await readCodexBarSnapshot()

    expect(result.error).toBe('CodexBar not found')
    expect(result.providers).toEqual([])
  })

  it('returns error + empty providers when permission denied (EACCES)', async () => {
    const err = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
    mockReadFile.mockRejectedValueOnce(err)

    const result = await readCodexBarSnapshot()

    expect(result.error).toMatch(/EACCES/)
    expect(result.providers).toEqual([])
  })

  it('returns parse error when file contains invalid JSON', async () => {
    mockReadFile.mockResolvedValueOnce('{{not json}}}')

    const result = await readCodexBarSnapshot()

    expect(result.error).toMatch(/parse/i)
    expect(result.providers).toEqual([])
  })

  it('returns parsed snapshot data on success', async () => {
    const snapshot = {
      providers: [
        {
          name: 'Claude',
          quotaInfo: { percentUsed: 72.1, resetTime: '2026-02-27T00:00:00Z', windowName: 'daily' },
          dailyUsage: [{ date: '2026-02-26', cost: 9.99, inputTokens: 300000, outputTokens: 100000 }],
          currentSession: { cost: 1.23, inputTokens: 50000, outputTokens: 20000 },
        },
      ],
      lastUpdated: '2026-02-26T10:00:00Z',
    }

    mockReadFile.mockResolvedValueOnce(JSON.stringify(snapshot))

    const result = await readCodexBarSnapshot()

    expect(result.error).toBeUndefined()
    expect(result.providers).toHaveLength(1)
    expect(result.providers[0].name).toBe('Claude')
    expect(result.providers[0].quotaInfo.percentUsed).toBe(72.1)
    expect(result.lastUpdated).toBe('2026-02-26T10:00:00Z')
  })

  it('handles multiple providers', async () => {
    const snapshot = {
      providers: [
        { name: 'Claude', quotaInfo: { percentUsed: 30, resetTime: '', windowName: 'daily' }, dailyUsage: [], currentSession: { cost: 0, inputTokens: 0, outputTokens: 0 } },
        { name: 'OpenAI', quotaInfo: { percentUsed: 55, resetTime: '', windowName: 'monthly' }, dailyUsage: [], currentSession: { cost: 0, inputTokens: 0, outputTokens: 0 } },
      ],
      lastUpdated: '2026-02-26T12:00:00Z',
    }

    mockReadFile.mockResolvedValueOnce(JSON.stringify(snapshot))

    const result = await readCodexBarSnapshot()

    expect(result.providers).toHaveLength(2)
    expect(result.providers[1].name).toBe('OpenAI')
  })
})
