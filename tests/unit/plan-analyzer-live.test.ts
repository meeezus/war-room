import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Tests for the live analyzePlan() function that calls Claude API
// ---------------------------------------------------------------------------

// Mock the Anthropic SDK before importing
const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate }
    constructor() {}
  }
  return { default: MockAnthropic }
})

import { analyzePlan, getAnalysisDepth, createStubAnalysis } from '@/lib/plan-analyzer'
import type { ParsedBead } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeBead = (overrides: Partial<ParsedBead> = {}): ParsedBead => ({
  id: 'BEAD-001',
  title: 'Test Bead',
  description: 'Do something',
  dependencies: [],
  blocks: [],
  size: 'M',
  accept: ['it works'],
  files: ['lib/foo.ts'],
  repo: 'war-room',
  domain: 'engineering',
  wave_index: 0,
  ...overrides,
})

const sampleBeads: ParsedBead[] = [
  makeBead({ id: 'BEAD-001', title: 'Setup infra', wave_index: 0 }),
  makeBead({ id: 'BEAD-002', title: 'Build feature', wave_index: 1 }),
]

// ---------------------------------------------------------------------------
// 1. getAnalysisDepth (preserved from existing tests, sanity check)
// ---------------------------------------------------------------------------

describe('getAnalysisDepth', () => {
  it('returns none for score <= 4', () => {
    expect(getAnalysisDepth(1)).toBe('none')
    expect(getAnalysisDepth(4)).toBe('none')
  })

  it('returns quick for scores 5-6', () => {
    expect(getAnalysisDepth(5)).toBe('quick')
    expect(getAnalysisDepth(6)).toBe('quick')
  })

  it('returns polyclaude for scores 7-8', () => {
    expect(getAnalysisDepth(7)).toBe('polyclaude')
    expect(getAnalysisDepth(8)).toBe('polyclaude')
  })

  it('returns council-matrix for score 9', () => {
    expect(getAnalysisDepth(9)).toBe('council-matrix')
  })
})

// ---------------------------------------------------------------------------
// 2. createStubAnalysis (backward compat)
// ---------------------------------------------------------------------------

describe('createStubAnalysis', () => {
  it('still exists and returns a valid PlanAnalysis', () => {
    const result = createStubAnalysis(5)
    expect(result).toHaveProperty('depth')
    expect(result).toHaveProperty('pushback')
    expect(result).toHaveProperty('alternatives')
    expect(result).toHaveProperty('blind_spots')
    expect(result).toHaveProperty('recommendation')
    expect(result).toHaveProperty('analyzed_at')
  })
})

// ---------------------------------------------------------------------------
// 3. analyzePlan — score <= 4 skips API call
// ---------------------------------------------------------------------------

describe('analyzePlan', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    mockCreate.mockReset()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv
    } else {
      delete process.env.ANTHROPIC_API_KEY
    }
  })

  it('returns auto-approve for score <= 4 without calling API', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const result = await analyzePlan('Low plan', '# Simple', sampleBeads, 3)

    expect(result.depth).toBe('none')
    expect(result.recommendation).toMatch(/[Ll]ow.?stakes|[Aa]uto/)
    expect(result.pushback).toEqual([])
    expect(result.alternatives).toEqual([])
    expect(result.blind_spots).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 4. analyzePlan — no API key returns fallback
  // ---------------------------------------------------------------------------

  it('returns fallback when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const result = await analyzePlan('Medium plan', '# Medium', sampleBeads, 6)

    expect(result.depth).toBe('quick')
    expect(result.pushback[0]).toMatch(/ANTHROPIC_API_KEY/)
    expect(result.recommendation).toMatch(/API key/)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 5. analyzePlan — successful API call parses JSON response
  // ---------------------------------------------------------------------------

  it('calls Claude API and parses JSON response for score > 4', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'

    const apiResponse = {
      pushback: ['Risk of scope creep', 'No rollback plan'],
      alternatives: ['Consider phased rollout'],
      blind_spots: ['Missing error handling'],
      recommendation: 'Proceed with modifications.',
    }

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(apiResponse) }],
    })

    const result = await analyzePlan('Medium plan', '# Medium plan\n\nDetails here.', sampleBeads, 6)

    expect(result.depth).toBe('quick')
    expect(result.pushback).toEqual(['Risk of scope creep', 'No rollback plan'])
    expect(result.alternatives).toEqual(['Consider phased rollout'])
    expect(result.blind_spots).toEqual(['Missing error handling'])
    expect(result.recommendation).toBe('Proceed with modifications.')
    expect(result.analyzed_at).toBeTruthy()
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  // ---------------------------------------------------------------------------
  // 6. analyzePlan — selects model based on depth
  // ---------------------------------------------------------------------------

  it('uses sonnet for quick depth (score 5-6)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"pushback":[],"alternatives":[],"blind_spots":[],"recommendation":"OK"}' }],
    })

    await analyzePlan('Plan', '# Plan', sampleBeads, 5)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
      })
    )
  })

  it('uses opus for polyclaude depth (score 7-8)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"pushback":[],"alternatives":[],"blind_spots":[],"recommendation":"OK"}' }],
    })

    await analyzePlan('Plan', '# Plan', sampleBeads, 7)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-6',
      })
    )
  })

  it('uses opus for council-matrix depth (score 9)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"pushback":[],"alternatives":[],"blind_spots":[],"recommendation":"OK"}' }],
    })

    await analyzePlan('Plan', '# Plan', sampleBeads, 9)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-6',
      })
    )
  })

  // ---------------------------------------------------------------------------
  // 7. analyzePlan — handles JSON wrapped in markdown code block
  // ---------------------------------------------------------------------------

  it('extracts JSON from markdown code block response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'

    const wrappedResponse = '```json\n{"pushback":["concern"],"alternatives":[],"blind_spots":[],"recommendation":"Go ahead."}\n```'

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: wrappedResponse }],
    })

    const result = await analyzePlan('Plan', '# Plan', sampleBeads, 6)

    expect(result.pushback).toEqual(['concern'])
    expect(result.recommendation).toBe('Go ahead.')
  })

  // ---------------------------------------------------------------------------
  // 8. analyzePlan — handles non-JSON response gracefully
  // ---------------------------------------------------------------------------

  it('handles non-JSON response gracefully', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Sorry, I cannot analyze this plan.' }],
    })

    const result = await analyzePlan('Plan', '# Plan', sampleBeads, 6)

    expect(result.depth).toBe('quick')
    expect(result.pushback).toEqual(['Analysis returned non-JSON response'])
    expect(result.recommendation).toMatch(/Sorry/)
  })

  // ---------------------------------------------------------------------------
  // 9. analyzePlan — handles API error gracefully
  // ---------------------------------------------------------------------------

  it('catches API errors and returns error analysis', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'

    mockCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'))

    const result = await analyzePlan('Plan', '# Plan', sampleBeads, 6)

    expect(result.depth).toBe('quick')
    expect(result.pushback[0]).toMatch(/Rate limit exceeded/)
    expect(result.recommendation).toMatch(/[Ee]rror|[Mm]anually/)
  })

  // ---------------------------------------------------------------------------
  // 10. analyzePlan — truncates arrays to max 3 items
  // ---------------------------------------------------------------------------

  it('limits pushback/alternatives/blind_spots to max 3 items', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'

    const verboseResponse = {
      pushback: ['a', 'b', 'c', 'd', 'e'],
      alternatives: ['x', 'y', 'z', 'w'],
      blind_spots: ['1', '2', '3', '4', '5'],
      recommendation: 'Too many concerns.',
    }

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(verboseResponse) }],
    })

    const result = await analyzePlan('Plan', '# Plan', sampleBeads, 7)

    expect(result.pushback.length).toBe(3)
    expect(result.alternatives.length).toBe(3)
    expect(result.blind_spots.length).toBe(3)
  })

  // ---------------------------------------------------------------------------
  // 11. analyzePlan — includes bead summary in prompt
  // ---------------------------------------------------------------------------

  it('includes bead summary in the user prompt', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"pushback":[],"alternatives":[],"blind_spots":[],"recommendation":"OK"}' }],
    })

    await analyzePlan('My Plan', '# My Plan\n\nContent', sampleBeads, 6)

    const callArgs = mockCreate.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content
    expect(userMsg).toContain('BEAD-001')
    expect(userMsg).toContain('BEAD-002')
    expect(userMsg).toContain('Setup infra')
    expect(userMsg).toContain('Build feature')
  })

  // ---------------------------------------------------------------------------
  // 12. analyzePlan — handles malformed JSON fields gracefully
  // ---------------------------------------------------------------------------

  it('handles malformed JSON fields with defaults', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'

    const badResponse = {
      pushback: 'not an array',
      alternatives: null,
      blind_spots: 42,
      recommendation: 123,
    }

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(badResponse) }],
    })

    const result = await analyzePlan('Plan', '# Plan', sampleBeads, 6)

    // Should use defaults for non-array fields
    expect(Array.isArray(result.pushback)).toBe(true)
    expect(Array.isArray(result.alternatives)).toBe(true)
    expect(Array.isArray(result.blind_spots)).toBe(true)
    expect(typeof result.recommendation).toBe('string')
  })
})
