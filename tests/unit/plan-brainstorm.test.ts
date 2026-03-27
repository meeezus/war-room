import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Plan Brainstorm Agent Tests
// ---------------------------------------------------------------------------

import { detectMode } from '@/lib/plan-brainstorm'

// ---------------------------------------------------------------------------
// 1. detectMode -- pure function, no mocks
// ---------------------------------------------------------------------------

describe('detectMode', () => {
  it('returns builder for internal tool ideas', () => {
    expect(detectMode('Build a CLI that syncs my Obsidian vault')).toBe('builder')
  })

  it('returns builder for single-signal ideas (below threshold)', () => {
    // Only one startup signal ("product") -- not enough for startup mode
    expect(detectMode('Make a product for my own use')).toBe('builder')
  })

  it('returns startup for ideas with 2+ startup signals', () => {
    expect(detectMode('SaaS product for gym owners to manage members and subscriptions')).toBe('startup')
  })

  it('returns startup for revenue-focused ideas', () => {
    expect(detectMode('Build a platform where customers can subscribe and we charge monthly')).toBe('startup')
  })

  it('returns startup for client/business ideas', () => {
    expect(detectMode('Pitch a client management tool for the business market')).toBe('startup')
  })

  it('returns builder for learning/personal projects', () => {
    expect(detectMode('Learn Rust by building a toy compiler')).toBe('builder')
  })

  it('returns builder for empty input', () => {
    expect(detectMode('')).toBe('builder')
  })

  it('is case insensitive', () => {
    expect(detectMode('SAAS SUBSCRIPTION platform for CUSTOMERS')).toBe('startup')
  })
})

// ---------------------------------------------------------------------------
// 2. brainstormPlan -- requires mocking Anthropic SDK
// ---------------------------------------------------------------------------

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
    },
  }
})

import { brainstormPlan } from '@/lib/plan-brainstorm'

describe('brainstormPlan', () => {
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

  it('returns null when no ANTHROPIC_API_KEY is set', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const result = await brainstormPlan('Build a CLI tool')
    expect(result).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns markdown and mode for a builder idea', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '# CLI Vault Sync\n\n**Mode:** Builder\n\n## BEAD-001: Core sync\n- **Depends on:** none\n- **Size:** S\n- **Accept:** Files sync correctly' }],
    })

    const result = await brainstormPlan('Build a CLI that syncs my vault')
    expect(result).not.toBeNull()
    expect(result!.mode).toBe('builder')
    expect(result!.markdown).toContain('CLI Vault Sync')
  })

  it('returns startup mode for revenue ideas', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '# Gym CRM\n\n**Mode:** Startup\n\n## BEAD-001: MVP\n- **Depends on:** none' }],
    })

    const result = await brainstormPlan('SaaS product for gym owners to manage customer subscriptions')
    expect(result).not.toBeNull()
    expect(result!.mode).toBe('startup')
  })

  it('returns null when API call fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCreate.mockRejectedValueOnce(new Error('rate limit'))

    const result = await brainstormPlan('Some idea')
    expect(result).toBeNull()
  })

  it('passes startup system prompt for startup ideas', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '# Test\n\n## BEAD-001: MVP' }],
    })

    await brainstormPlan('SaaS subscription product for paying customers')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('YC-style'),
      }),
    )
  })

  it('passes builder system prompt for builder ideas', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '# Test\n\n## BEAD-001: Build' }],
    })

    await brainstormPlan('Internal CLI tool for my vault')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('technical advisor'),
      }),
    )
  })

  it('uses claude-sonnet-4-6 model', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '# Test' }],
    })

    await brainstormPlan('Some idea about subscription pricing')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
      }),
    )
  })
})
