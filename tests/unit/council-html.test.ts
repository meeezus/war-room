import { describe, it, expect } from 'vitest'
import { buildPlanHtmlPrompt, stripHtmlFences } from '@/app/api/chat/council/plan-html'

describe('buildPlanHtmlPrompt', () => {
  it('returns a string containing the conversation text', () => {
    const conversation = '[Sensei]: Should we add caching?\n\n[Ed]: Yes, Redis is ideal.'
    const result = buildPlanHtmlPrompt(conversation)
    expect(result).toContain(conversation)
  })

  it('includes house palette CSS variables in the prompt', () => {
    const result = buildPlanHtmlPrompt('test conversation')
    expect(result).toContain('#0a0a0a')
    expect(result).toContain('#141414')
    expect(result).toContain('#22c55e')
  })

  it('instructs Claude to return only HTML', () => {
    const result = buildPlanHtmlPrompt('test conversation')
    expect(result.toLowerCase()).toContain('only')
    expect(result.toLowerCase()).toContain('html')
  })

  it('mentions Inter and JetBrains Mono fonts', () => {
    const result = buildPlanHtmlPrompt('test conversation')
    expect(result).toContain('Inter')
    expect(result).toContain('JetBrains Mono')
  })
})

describe('stripHtmlFences', () => {
  it('returns clean HTML when no fences present', () => {
    const html = '<html><body>Hello</body></html>'
    expect(stripHtmlFences(html)).toBe(html)
  })

  it('strips ```html fences', () => {
    const raw = '```html\n<html><body>Hello</body></html>\n```'
    expect(stripHtmlFences(raw)).toBe('<html><body>Hello</body></html>')
  })

  it('strips ``` fences without language tag', () => {
    const raw = '```\n<html><body>Hello</body></html>\n```'
    expect(stripHtmlFences(raw)).toBe('<html><body>Hello</body></html>')
  })

  it('trims whitespace', () => {
    const raw = '  \n```html\n  <div>test</div>  \n```\n  '
    expect(stripHtmlFences(raw)).toBe('<div>test</div>')
  })

  it('handles multiple code fences by stripping outer ones', () => {
    const raw = '```html\n<div>has ``` inside</div>\n```'
    const result = stripHtmlFences(raw)
    expect(result).toContain('<div>')
  })
})
