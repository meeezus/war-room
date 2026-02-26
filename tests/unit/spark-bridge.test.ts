// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fs/promises and fs before importing the module
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}))

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
}))

import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import {
  emitToSpark,
  emitDecision,
  emitAction,
  emitInsight,
  isSparkAvailable,
  type SparkEventV1,
} from '@/lib/spark-bridge'

describe('spark-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mocks to default successful behavior
    vi.mocked(writeFile).mockResolvedValue(undefined)
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(existsSync).mockReturnValue(true)
    // Mock process.env.HOME
    vi.stubEnv('HOME', '/Users/test')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  describe('isSparkAvailable', () => {
    it('returns true when ~/.spark directory exists', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      expect(isSparkAvailable()).toBe(true)
      expect(existsSync).toHaveBeenCalledWith('/Users/test/.spark')
    })

    it('returns false when ~/.spark directory does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false)
      expect(isSparkAvailable()).toBe(false)
    })

    it('returns false when existsSync throws', () => {
      vi.mocked(existsSync).mockImplementation(() => {
        throw new Error('permission denied')
      })
      expect(isSparkAvailable()).toBe(false)
    })
  })

  describe('emitToSpark', () => {
    it('writes a valid SparkEventV1 JSON to ~/.spark/inbox/', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      const now = 1700000000000
      vi.spyOn(Date, 'now').mockReturnValue(now)

      const result = await emitToSpark('decision', 'council_vote', { approved: true }, {
        sessionId: 'test-session',
        context: 'test context',
      })

      expect(result).toBe(true)

      // Should ensure inbox directory exists
      expect(mkdir).toHaveBeenCalledWith(
        '/Users/test/.spark/inbox',
        { recursive: true }
      )

      // Should write a file with correct naming pattern
      expect(writeFile).toHaveBeenCalledTimes(1)
      const [filePath, content] = vi.mocked(writeFile).mock.calls[0] as [string, string]

      expect(filePath).toMatch(/\/Users\/test\/\.spark\/inbox\/war-room-\d+-aaaaaaaa\.json/)

      // Parse and validate the written event
      const event: SparkEventV1 = JSON.parse(content)
      expect(event.v).toBe(1)
      expect(event.source).toBe('war-room')
      expect(event.kind).toBe('decision')
      expect(event.ts).toBe(Math.floor(now / 1000))
      expect(event.session_id).toBe('test-session')
      expect(event.payload.action_type).toBe('council_vote')
      expect(event.payload.result).toEqual({ approved: true })
      expect(event.payload.context).toBe('test context')
      expect(event.trace_id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    })

    it('returns false when Spark is not available', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const result = await emitToSpark('action', 'test', {})
      expect(result).toBe(false)
      expect(writeFile).not.toHaveBeenCalled()
    })

    it('returns false when called from client (window defined)', async () => {
      vi.stubGlobal('window', {})

      const result = await emitToSpark('action', 'test', {})
      expect(result).toBe(false)
      expect(writeFile).not.toHaveBeenCalled()
    })

    it('returns false and logs error when writeFile fails', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(writeFile).mockRejectedValue(new Error('disk full'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await emitToSpark('insight', 'test', {})

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('[Spark] Failed:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('uses default session_id when none provided', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      await emitToSpark('action', 'test', {})

      const [, content] = vi.mocked(writeFile).mock.calls[0] as [string, string]
      const event: SparkEventV1 = JSON.parse(content)
      expect(event.session_id).toBe('war-room-default')
    })
  })

  describe('emitDecision', () => {
    it('calls emitToSpark with kind=decision', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const result = await emitDecision('council_vote', { passed: true }, 'vote context')

      expect(result).toBe(true)
      const [, content] = vi.mocked(writeFile).mock.calls[0] as [string, string]
      const event: SparkEventV1 = JSON.parse(content)
      expect(event.kind).toBe('decision')
      expect(event.payload.action_type).toBe('council_vote')
      expect(event.payload.context).toBe('vote context')
    })
  })

  describe('emitAction', () => {
    it('calls emitToSpark with kind=action', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const result = await emitAction('deploy', { version: '1.0' }, 'deploy context')

      expect(result).toBe(true)
      const [, content] = vi.mocked(writeFile).mock.calls[0] as [string, string]
      const event: SparkEventV1 = JSON.parse(content)
      expect(event.kind).toBe('action')
      expect(event.payload.action_type).toBe('deploy')
    })
  })

  describe('emitInsight', () => {
    it('calls emitToSpark with kind=insight and wraps insight string', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const result = await emitInsight('Pattern detected: council always approves at night', {
        confidence: 0.9,
      })

      expect(result).toBe(true)
      const [, content] = vi.mocked(writeFile).mock.calls[0] as [string, string]
      const event: SparkEventV1 = JSON.parse(content)
      expect(event.kind).toBe('insight')
      expect(event.payload.action_type).toBe('insight')
      expect(event.payload.result).toEqual({
        insight: 'Pattern detected: council always approves at night',
        confidence: 0.9,
      })
    })
  })
})
