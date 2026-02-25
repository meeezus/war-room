import { describe, it, expect } from 'vitest'
import { MAKIMA_SYNTHESIS_PROMPT } from '@/lib/makima-synthesis-prompt'

describe('MAKIMA_SYNTHESIS_PROMPT', () => {
  it('exports a non-empty string', () => {
    expect(typeof MAKIMA_SYNTHESIS_PROMPT).toBe('string')
    expect(MAKIMA_SYNTHESIS_PROMPT.length).toBeGreaterThan(100)
  })

  it('identifies as Makima', () => {
    expect(MAKIMA_SYNTHESIS_PROMPT).toContain('Makima')
  })

  it('references her COO role', () => {
    const lower = MAKIMA_SYNTHESIS_PROMPT.toLowerCase()
    expect(lower).toContain('coo') // could also say Chief Operating Officer
  })

  it('includes synthesis instructions (not just identity)', () => {
    const lower = MAKIMA_SYNTHESIS_PROMPT.toLowerCase()
    expect(lower).toContain('synthe') // synthesis/synthesize/synthesizer
  })

  it('includes guidance on handling dissent', () => {
    const lower = MAKIMA_SYNTHESIS_PROMPT.toLowerCase()
    // Makima should address disagreement/dissent/counterargument
    const hasDissent = lower.includes('dissent') || lower.includes('disagree') || lower.includes('counterargument')
    expect(hasDissent).toBe(true)
  })

  it('includes a clear recommendation directive', () => {
    const lower = MAKIMA_SYNTHESIS_PROMPT.toLowerCase()
    expect(lower).toContain('recommend')
  })

  it('captures Makima voice traits: direct, pattern-oriented, strategic', () => {
    const lower = MAKIMA_SYNTHESIS_PROMPT.toLowerCase()
    // She should be direct (no hedging)
    const hasDirect = lower.includes('direct') || lower.includes('no hedging') || lower.includes('no filler')
    expect(hasDirect).toBe(true)
    // She should be pattern-oriented
    const hasPattern = lower.includes('pattern') || lower.includes('connect')
    expect(hasPattern).toBe(true)
  })

  it('instructs weighting perspectives by domain relevance', () => {
    const lower = MAKIMA_SYNTHESIS_PROMPT.toLowerCase()
    const hasWeighting = lower.includes('weight') || lower.includes('relevance') || lower.includes('domain')
    expect(hasWeighting).toBe(true)
  })
})

describe('council route uses Makima synthesis prompt', () => {
  // We test that buildCouncilPrompt integrates MAKIMA_SYNTHESIS_PROMPT
  // by importing the prompt builder and checking its output

  it('buildCouncilPrompt includes Makima identity in synthesis section', async () => {
    const { buildCouncilPrompt } = await import('@/app/api/chat/council/council-prompt')
    const result = buildCouncilPrompt('test conversation')
    expect(result).toContain('Makima')
    expect(result.toLowerCase()).toContain('synthe')
  })

  it('buildCouncilPrompt includes the MAKIMA_SYNTHESIS_PROMPT content', async () => {
    const { buildCouncilPrompt } = await import('@/app/api/chat/council/council-prompt')
    const result = buildCouncilPrompt('test conversation')
    // The prompt should contain key phrases from MAKIMA_SYNTHESIS_PROMPT
    expect(result.toLowerCase()).toContain('coo')
  })

  it('buildCouncilPrompt still includes the conversation text', async () => {
    const { buildCouncilPrompt } = await import('@/app/api/chat/council/council-prompt')
    const convo = '[Sensei]: Should we add caching?\n\n[Ed]: Redis looks good.'
    const result = buildCouncilPrompt(convo)
    expect(result).toContain(convo)
  })

  it('buildCouncilPrompt still includes all five Daimyo voices', async () => {
    const { buildCouncilPrompt } = await import('@/app/api/chat/council/council-prompt')
    const result = buildCouncilPrompt('test')
    expect(result).toContain('Light')
    expect(result).toContain('L')
    expect(result).toContain('Ed')
    expect(result).toContain('Major')
    expect(result).toContain('Nanami')
  })

  it('buildCouncilPrompt requests JSON output format', async () => {
    const { buildCouncilPrompt } = await import('@/app/api/chat/council/council-prompt')
    const result = buildCouncilPrompt('test')
    expect(result).toContain('"reviews"')
    expect(result).toContain('"synthesis"')
    expect(result).toContain('"recommendation"')
    expect(result).toContain('"dissent"')
  })
})
