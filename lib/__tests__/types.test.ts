import { describe, it, expect } from 'vitest'
import type {
  ProbeResult,
  ServiceHealthResponse,
  MemoryStatusResponse,
  ActivityItem,
  ActivityFeedResponse,
  SystemFitness,
  OutcomeCategory,
  OutcomeCard,
} from '@/lib/types'

describe('New Operations Hub types', () => {
  describe('ProbeResult', () => {
    it('supports a passing probe', () => {
      const result: ProbeResult = { ok: true, detail: 'running', latencyMs: 42 }
      expect(result.ok).toBe(true)
      expect(result.latencyMs).toBe(42)
    })

    it('supports a failing probe with unavailable flag', () => {
      const result: ProbeResult = { ok: false, detail: 'local-only', unavailable: true }
      expect(result.unavailable).toBe(true)
    })

    it('supports optional meta field', () => {
      const result: ProbeResult = { ok: true, detail: 'ok', meta: { insightCount: 150 } }
      expect(result.meta).toEqual({ insightCount: 150 })
    })
  })

  describe('ServiceHealthResponse', () => {
    it('has required fields with correct types', () => {
      const resp: ServiceHealthResponse = {
        overall: 'nominal',
        checkedAt: '2026-03-25T12:00:00Z',
        isLocal: true,
        services: {
          sparkd: { ok: true, detail: 'running', latencyMs: 15 },
          poller: { ok: false, detail: 'not running' },
        },
      }
      expect(resp.overall).toBe('nominal')
      expect(resp.isLocal).toBe(true)
      expect(resp.services.sparkd.ok).toBe(true)
    })

    it('supports all overall states', () => {
      const states: ServiceHealthResponse['overall'][] = ['nominal', 'degraded', 'down', 'unavailable']
      expect(states).toHaveLength(4)
    })
  })

  describe('MemoryStatusResponse', () => {
    it('has required fields', () => {
      const resp: MemoryStatusResponse = {
        checkedAt: '2026-03-25T12:00:00Z',
        isLocal: true,
        layers: {
          spark: { ok: true, insightCount: 42 },
          losslessClaw: { ok: false, reason: 'db missing' },
        },
        fitness: null,
      }
      expect(resp.layers.spark.ok).toBe(true)
      expect(resp.fitness).toBeNull()
    })

    it('accepts SystemFitness in fitness field', () => {
      const fitness: SystemFitness = {
        missRate: 0.12,
        missRateTrend: 'improving',
        corrections: 5,
        correctionsPrevPeriod: 8,
        skillsImproved: 2,
        sessions: 15,
        digest: 'System performing well',
        computedAt: '2026-03-25T12:00:00Z',
      }
      const resp: MemoryStatusResponse = {
        checkedAt: '2026-03-25T12:00:00Z',
        isLocal: true,
        layers: {},
        fitness,
      }
      expect(resp.fitness?.missRate).toBe(0.12)
      expect(resp.fitness?.missRateTrend).toBe('improving')
    })
  })

  describe('ActivityItem', () => {
    it('supports all source types', () => {
      const sources: ActivityItem['source'][] = ['spark', 'tab_ledger', 'makima', 'poller', 'engine']
      expect(sources).toHaveLength(5)
    })

    it('has required fields', () => {
      const item: ActivityItem = {
        source: 'spark',
        type: 'insight_promoted',
        title: 'New insight',
        detail: 'Context about the insight',
        timestamp: '2026-03-25T12:00:00Z',
      }
      expect(item.source).toBe('spark')
      expect(item.detail).toBe('Context about the insight')
    })

    it('allows null detail', () => {
      const item: ActivityItem = {
        source: 'engine',
        type: 'mission_complete',
        title: 'Done',
        detail: null,
        timestamp: '2026-03-25T12:00:00Z',
      }
      expect(item.detail).toBeNull()
    })
  })

  describe('ActivityFeedResponse', () => {
    it('has required fields', () => {
      const resp: ActivityFeedResponse = {
        isLocal: false,
        items: [
          { source: 'poller', type: 'cycle', title: 'Poll', detail: null, timestamp: '2026-03-25T12:00:00Z' },
        ],
      }
      expect(resp.isLocal).toBe(false)
      expect(resp.items).toHaveLength(1)
    })
  })

  describe('SystemFitness', () => {
    it('has all required fields', () => {
      const fitness: SystemFitness = {
        missRate: 0.05,
        missRateTrend: 'stable',
        corrections: 3,
        correctionsPrevPeriod: 3,
        skillsImproved: 1,
        sessions: 20,
        digest: 'Stable performance',
        computedAt: '2026-03-25T12:00:00Z',
      }
      expect(fitness.missRateTrend).toBe('stable')
      expect(fitness.sessions).toBe(20)
    })

    it('supports all trend values', () => {
      const trends: SystemFitness['missRateTrend'][] = ['improving', 'stable', 'degrading']
      expect(trends).toHaveLength(3)
    })
  })

  describe('OutcomeCategory', () => {
    it('supports the four renamed categories', () => {
      const categories: OutcomeCategory[] = ['research', 'aeon', 'opsec', 'messages']
      expect(categories).toHaveLength(4)
    })
  })

  describe('OutcomeCard', () => {
    it('has required fields', () => {
      const card: OutcomeCard = {
        category: 'research',
        headline: 'Research pipeline initializing',
        detail: null,
        count: 0,
      }
      expect(card.category).toBe('research')
      expect(card.count).toBe(0)
    })

    it('supports optional action fields', () => {
      const card: OutcomeCard = {
        category: 'aeon',
        headline: '2 proposals',
        detail: 'Commerce proposals pending',
        count: 2,
        actionLabel: 'Review',
        actionHref: '/objectives',
        items: [
          { title: 'Prop A', timestamp: '2026-03-25T12:00:00Z', status: 'pending' },
        ],
      }
      expect(card.actionLabel).toBe('Review')
      expect(card.items).toHaveLength(1)
    })
  })
})
