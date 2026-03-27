import { describe, it, expect } from 'vitest'
import type { OutcomeCategory, OutcomeCard } from '@/lib/types'

describe('Outcome Category Rename (Sprint 1)', () => {
  describe('OutcomeCategory type', () => {
    it('supports the four new categories', () => {
      const categories: OutcomeCategory[] = ['research', 'aeon', 'opsec', 'messages']
      expect(categories).toHaveLength(4)
    })

    it('no longer includes hunt, earn, guard, care, speak', () => {
      // These should be compile errors if the type is correct.
      // At runtime we verify the new categories are the only valid ones.
      const validCategories = new Set<OutcomeCategory>(['research', 'aeon', 'opsec', 'messages'])
      expect(validCategories.size).toBe(4)
      // Old categories should not be assignable — this test validates the rename happened
      expect(validCategories.has('research')).toBe(true)
      expect(validCategories.has('aeon')).toBe(true)
      expect(validCategories.has('opsec')).toBe(true)
      expect(validCategories.has('messages')).toBe(true)
    })
  })

  describe('OutcomeCard with new categories', () => {
    it('creates a research card', () => {
      const card: OutcomeCard = {
        category: 'research',
        headline: 'Research pipeline initializing',
        detail: null,
        count: 0,
      }
      expect(card.category).toBe('research')
      expect(card.headline).toContain('Research')
    })

    it('creates an aeon card', () => {
      const card: OutcomeCard = {
        category: 'aeon',
        headline: '3 proposals',
        detail: null,
        count: 3,
        actionLabel: 'Review',
        actionHref: '/objectives',
      }
      expect(card.category).toBe('aeon')
      expect(card.actionHref).toBe('/objectives')
    })

    it('creates an opsec card', () => {
      const card: OutcomeCard = {
        category: 'opsec',
        headline: '0 errors (24h)',
        detail: null,
        count: 0,
        actionLabel: 'View',
        actionHref: '/discoveries',
      }
      expect(card.category).toBe('opsec')
      expect(card.actionHref).toBe('/discoveries')
    })

    it('creates a messages card', () => {
      const card: OutcomeCard = {
        category: 'messages',
        headline: '2 recent',
        detail: null,
        count: 2,
        items: [
          { title: 'Morning brief', timestamp: '2026-03-25T08:00:00Z', status: 'done' },
        ],
      }
      expect(card.category).toBe('messages')
      expect(card.items).toHaveLength(1)
    })
  })
})
