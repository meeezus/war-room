import { describe, it, expect } from 'vitest'
import { parsePlanMarkdown } from '@/lib/plan-parser'
import type { ParsedBead } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function beadById(beads: ParsedBead[], id: string): ParsedBead | undefined {
  return beads.find((b) => b.id === id)
}

// ---------------------------------------------------------------------------
// Basic extraction
// ---------------------------------------------------------------------------

describe('parsePlanMarkdown', () => {
  describe('title extraction', () => {
    it('extracts title from first # heading', () => {
      const md = `# My Great Plan\n\nSome intro text.\n`
      const result = parsePlanMarkdown(md)
      expect(result.title).toBe('My Great Plan')
    })

    it('uses first line when no # heading exists', () => {
      const md = `Just a title line\n\nSome content.\n`
      const result = parsePlanMarkdown(md)
      expect(result.title).toBe('Just a title line')
    })

    it('returns empty title for empty markdown', () => {
      const result = parsePlanMarkdown('')
      expect(result.title).toBe('')
      expect(result.beads).toEqual([])
      expect(result.waves).toEqual([])
    })
  })

  // ---------------------------------------------------------------------------
  // Bead extraction
  // ---------------------------------------------------------------------------

  describe('bead extraction', () => {
    it('extracts a single bead with ### header', () => {
      const md = `# Plan\n\n### BEAD-001: Setup database\nCreate the tables.\n`
      const result = parsePlanMarkdown(md)
      expect(result.beads).toHaveLength(1)
      expect(result.beads[0].id).toBe('BEAD-001')
      expect(result.beads[0].title).toBe('Setup database')
    })

    it('extracts a bead with ## header', () => {
      const md = `# Plan\n\n## BEAD-042: Big task\nDo the thing.\n`
      const result = parsePlanMarkdown(md)
      expect(result.beads).toHaveLength(1)
      expect(result.beads[0].id).toBe('BEAD-042')
      expect(result.beads[0].title).toBe('Big task')
    })

    it('extracts multiple beads', () => {
      const md = [
        '# Plan',
        '',
        '### BEAD-001: First',
        'First bead content.',
        '',
        '### BEAD-002: Second',
        'Second bead content.',
        '',
        '### BEAD-003: Third',
        'Third bead content.',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads).toHaveLength(3)
      expect(result.beads.map((b) => b.id)).toEqual(['BEAD-001', 'BEAD-002', 'BEAD-003'])
    })

    it('stops bead content at --- separator', () => {
      const md = [
        '# Plan',
        '',
        '### BEAD-001: First',
        'Content here.',
        '',
        '---',
        '',
        'This is NOT part of the bead.',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads).toHaveLength(1)
      expect(result.beads[0].description).toContain('Content here')
      expect(result.beads[0].description).not.toContain('NOT part')
    })
  })

  // ---------------------------------------------------------------------------
  // Field extraction
  // ---------------------------------------------------------------------------

  describe('field extraction', () => {
    it('extracts dependencies', () => {
      const md = [
        '# Plan',
        '### BEAD-003: Some task',
        '- **Depends on:** 001, 002',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].dependencies).toEqual(['BEAD-001', 'BEAD-002'])
    })

    it('handles "none" dependencies', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Root',
        '- **Depends on:** none',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].dependencies).toEqual([])
    })

    it('extracts blocks field', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Root',
        '- **Blocks:** 002, 003, 004',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].blocks).toEqual(['BEAD-002', 'BEAD-003', 'BEAD-004'])
    })

    it('extracts size', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Small task',
        '- **Size:** S',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].size).toBe('S')
    })

    it('defaults size to M', () => {
      const md = '# Plan\n### BEAD-001: No size\nJust content.'
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].size).toBe('M')
    })

    it('extracts acceptance criteria', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Task',
        '- **Accept:** Migration applied. Tests pass. Build succeeds.',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].accept).toEqual(['Migration applied. Tests pass. Build succeeds.'])
    })

    it('extracts file paths from backtick-wrapped entries', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Task',
        '- **Files:** `lib/parser.ts`, `lib/__tests__/parser.test.ts`',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].files).toContain('lib/parser.ts')
      expect(result.beads[0].files).toContain('lib/__tests__/parser.test.ts')
    })

    it('extracts file paths from list items', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Task',
        '**Files:**',
        '- `lib/parser.ts` (create)',
        '- `lib/types.ts` (modify)',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].files).toContain('lib/parser.ts')
      expect(result.beads[0].files).toContain('lib/types.ts')
    })

    it('extracts model', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Complex task',
        '- **Model:** opus',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].model).toBe('opus')
    })

    it('defaults model to sonnet', () => {
      const md = '# Plan\n### BEAD-001: Task\nContent.'
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].model).toBe('sonnet')
    })

    it('extracts domain', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Biz task',
        '- **Domain:** product',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].domain).toBe('product')
    })

    it('defaults domain to engineering', () => {
      const md = '# Plan\n### BEAD-001: Task\nContent.'
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].domain).toBe('engineering')
    })

    it('extracts repo name', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Engine task',
        '- **Repo:** shogunate',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].repo).toBe('shogunate')
    })

    it('infers repo from file paths — shogunate', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Engine task',
        '- **Files:** `~/Code/shogunate/engine/foo.py`',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].repo).toBe('shogunate')
    })

    it('infers repo war-room from app/ paths', () => {
      const md = [
        '# Plan',
        '### BEAD-001: UI task',
        '- **Files:** `app/plans/page.tsx`',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].repo).toBe('war-room')
    })

    it('infers repo war-room from lib/ paths', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Lib task',
        '- **Files:** `lib/plan-parser.ts`',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].repo).toBe('war-room')
    })

    it('infers repo war-room from components/ paths', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Component task',
        '- **Files:** `components/sidebar.tsx`',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].repo).toBe('war-room')
    })

    it('extracts description from non-field content', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Setup',
        'This is the description of what we do.',
        'It can span multiple lines.',
        '',
        '- **Size:** S',
        '- **Depends on:** none',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].description).toContain('This is the description')
      expect(result.beads[0].description).toContain('multiple lines')
    })

    it('extracts JTBD as part of description', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Setup',
        '**JTBD:** When I need X, I want Y so that Z.',
        '',
        '- **Size:** S',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].description).toContain('When I need X, I want Y so that Z')
    })

    it('extracts Outcome as part of description', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Setup',
        '**Outcome:** The database is ready.',
        '',
        '- **Size:** S',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].description).toContain('The database is ready')
    })
  })

  // ---------------------------------------------------------------------------
  // Flywheel score
  // ---------------------------------------------------------------------------

  describe('flywheel score', () => {
    it('extracts all three dimensions', () => {
      const md = [
        '# Plan',
        '',
        'Money: 3',
        'Blast Radius: 2',
        'Novelty: 1',
        '',
        '### BEAD-001: Task',
        'Content.',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.scoreBreakdown).toEqual({ money: 3, blast_radius: 2, novelty: 1 })
      expect(result.flywheelScore).toBe(6)
    })

    it('handles "Money at stake:" variant', () => {
      const md = [
        '# Plan',
        'Money at stake: 2',
        'Blast radius: 1',
        'Novelty: 3',
        '',
        '### BEAD-001: Task',
        'Content.',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.scoreBreakdown).toEqual({ money: 2, blast_radius: 1, novelty: 3 })
      expect(result.flywheelScore).toBe(6)
    })

    it('defaults all scores to 2 when not found', () => {
      const md = '# Plan\n### BEAD-001: Task\nContent.'
      const result = parsePlanMarkdown(md)
      expect(result.scoreBreakdown).toEqual({ money: 2, blast_radius: 2, novelty: 2 })
      expect(result.flywheelScore).toBe(6)
    })
  })

  // ---------------------------------------------------------------------------
  // Topological sort / wave computation
  // ---------------------------------------------------------------------------

  describe('wave computation (topological sort)', () => {
    it('assigns wave 0 to beads with no dependencies', () => {
      const md = [
        '# Plan',
        '### BEAD-001: First',
        '- **Depends on:** none',
        '### BEAD-002: Second',
        '- **Depends on:** none',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].wave_index).toBe(0)
      expect(result.beads[1].wave_index).toBe(0)
      expect(result.waves).toHaveLength(1)
      expect(result.waves[0]).toHaveLength(2)
    })

    it('handles linear dependency chain A -> B -> C', () => {
      const md = [
        '# Plan',
        '### BEAD-001: First',
        '- **Depends on:** none',
        '### BEAD-002: Second',
        '- **Depends on:** 001',
        '### BEAD-003: Third',
        '- **Depends on:** 002',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].wave_index).toBe(0)
      expect(result.beads[1].wave_index).toBe(1)
      expect(result.beads[2].wave_index).toBe(2)
      expect(result.waveCount).toBe(3)
    })

    it('handles diamond dependency (A->B, A->C, B+C->D)', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Root',
        '- **Depends on:** none',
        '### BEAD-002: Left',
        '- **Depends on:** 001',
        '### BEAD-003: Right',
        '- **Depends on:** 001',
        '### BEAD-004: Join',
        '- **Depends on:** 002, 003',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(beadById(result.beads, 'BEAD-001')?.wave_index).toBe(0)
      expect(beadById(result.beads, 'BEAD-002')?.wave_index).toBe(1)
      expect(beadById(result.beads, 'BEAD-003')?.wave_index).toBe(1)
      expect(beadById(result.beads, 'BEAD-004')?.wave_index).toBe(2)
      expect(result.waveCount).toBe(3)
      expect(result.waves).toHaveLength(3)
    })

    it('throws on cyclic dependency', () => {
      const md = [
        '# Plan',
        '### BEAD-001: A',
        '- **Depends on:** 002',
        '### BEAD-002: B',
        '- **Depends on:** 001',
      ].join('\n')
      expect(() => parsePlanMarkdown(md)).toThrow(/cycle/i)
    })

    it('throws on self-dependency', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Self',
        '- **Depends on:** 001',
      ].join('\n')
      expect(() => parsePlanMarkdown(md)).toThrow(/cycle/i)
    })

    it('groups beads correctly in waves array', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Root',
        '- **Depends on:** none',
        '### BEAD-002: Mid-A',
        '- **Depends on:** 001',
        '### BEAD-003: Mid-B',
        '- **Depends on:** 001',
        '### BEAD-004: End',
        '- **Depends on:** 002, 003',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.waves[0].map((b) => b.id)).toEqual(['BEAD-001'])
      expect(result.waves[1].map((b) => b.id).sort()).toEqual(['BEAD-002', 'BEAD-003'])
      expect(result.waves[2].map((b) => b.id)).toEqual(['BEAD-004'])
    })
  })

  // ---------------------------------------------------------------------------
  // The actual Plan Runner spec (8 beads)
  // ---------------------------------------------------------------------------

  describe('real plan: Plan Runner spec', () => {
    // Use the actual spec beads section
    const planRunnerMd = [
      '# Plan Runner -- Drop a Plan, Watch It Execute',
      '',
      'Money: 2',
      'Blast Radius: 2',
      'Novelty: 3',
      '',
      '## Beads',
      '',
      '### BEAD-001: Plans table migration + types',
      '- **Depends on:** none',
      '- **Blocks:** 002, 003, 004, 005',
      '- **Size:** S',
      '- **Accept:** Migration applied. Plan + ParsedBead types in lib/types.ts. `npm run build` passes.',
      '- **Files:** `supabase/migrations/YYYYMMDD_plans.sql`, `lib/types.ts`',
      '',
      '### BEAD-002: Plan parser library',
      '- **Depends on:** 001',
      '- **Blocks:** 003',
      '- **Size:** M',
      '- **Accept:** `parsePlanMarkdown(md)` extracts beads with dependencies, computes waves via topological sort, computes flywheel score. Unit tests pass.',
      '- **Files:** `lib/plan-parser.ts`, `lib/__tests__/plan-parser.test.ts`',
      '',
      '### BEAD-003: Plan API routes (CRUD + ingest + analysis)',
      '- **Depends on:** 001, 002',
      '- **Blocks:** 005, 006',
      '- **Size:** L',
      '- **Accept:** POST /api/plans/ingest accepts markdown, parses beads, scores flywheel.',
      '- **Files:** `app/api/plans/ingest/route.ts`, `app/api/plans/route.ts`, `app/api/plans/[id]/route.ts`',
      '',
      '### BEAD-004: Plan approval + execution bridge',
      '- **Depends on:** 001, 003',
      '- **Blocks:** 007',
      '- **Size:** M',
      '- **Accept:** POST /api/plans/[id]/approve transitions plan to running.',
      '- **Files:** `app/api/plans/[id]/approve/route.ts`',
      '',
      '### BEAD-005: Wave advancement cron',
      '- **Depends on:** 004',
      '- **Blocks:** 007',
      '- **Size:** S',
      '- **Accept:** Every 30s, checks running plans.',
      '- **Files:** `app/api/cron/plan-waves/route.ts`',
      '',
      '### BEAD-006: Plans list + detail pages',
      '- **Depends on:** 003',
      '- **Blocks:** 007',
      '- **Size:** L',
      '- **Accept:** /plans page shows plan list with status badges.',
      '- **Files:** `app/plans/page.tsx`, `app/plans/[id]/page.tsx`, `components/plan-wave-graph.tsx`',
      '',
      '### BEAD-007: Live progress + realtime',
      '- **Depends on:** 004, 005, 006',
      '- **Blocks:** none',
      '- **Size:** M',
      '- **Accept:** Plan detail page shows live bead status via realtime subscriptions.',
      '- **Files:** `lib/realtime.ts`, `app/plans/[id]/page.tsx`',
      '',
      '### BEAD-008: Obsidian vault sync',
      '- **Depends on:** 003',
      '- **Blocks:** none',
      '- **Size:** S',
      '- **Accept:** When a plan is ingested, a markdown copy is saved to vault.',
      '- **Files:** `lib/vault-sync.ts`',
    ].join('\n')

    it('extracts all 8 beads', () => {
      const result = parsePlanMarkdown(planRunnerMd)
      expect(result.beads).toHaveLength(8)
    })

    it('extracts correct title', () => {
      const result = parsePlanMarkdown(planRunnerMd)
      expect(result.title).toBe('Plan Runner -- Drop a Plan, Watch It Execute')
    })

    it('extracts flywheel score 7 (2+2+3)', () => {
      const result = parsePlanMarkdown(planRunnerMd)
      expect(result.flywheelScore).toBe(7)
      expect(result.scoreBreakdown).toEqual({ money: 2, blast_radius: 2, novelty: 3 })
    })

    it('assigns correct dependencies', () => {
      const result = parsePlanMarkdown(planRunnerMd)
      expect(beadById(result.beads, 'BEAD-001')?.dependencies).toEqual([])
      expect(beadById(result.beads, 'BEAD-002')?.dependencies).toEqual(['BEAD-001'])
      expect(beadById(result.beads, 'BEAD-003')?.dependencies).toEqual(['BEAD-001', 'BEAD-002'])
      expect(beadById(result.beads, 'BEAD-004')?.dependencies).toEqual(['BEAD-001', 'BEAD-003'])
      expect(beadById(result.beads, 'BEAD-005')?.dependencies).toEqual(['BEAD-004'])
      expect(beadById(result.beads, 'BEAD-006')?.dependencies).toEqual(['BEAD-003'])
      expect(beadById(result.beads, 'BEAD-007')?.dependencies).toEqual(['BEAD-004', 'BEAD-005', 'BEAD-006'])
      expect(beadById(result.beads, 'BEAD-008')?.dependencies).toEqual(['BEAD-003'])
    })

    it('computes correct wave indices', () => {
      const result = parsePlanMarkdown(planRunnerMd)
      // Wave 0: BEAD-001 (no deps)
      expect(beadById(result.beads, 'BEAD-001')?.wave_index).toBe(0)
      // Wave 1: BEAD-002 (depends on 001)
      expect(beadById(result.beads, 'BEAD-002')?.wave_index).toBe(1)
      // Wave 2: BEAD-003 (depends on 001, 002)
      expect(beadById(result.beads, 'BEAD-003')?.wave_index).toBe(2)
      // Wave 3: BEAD-004 (depends on 001, 003), BEAD-006 (depends on 003), BEAD-008 (depends on 003)
      expect(beadById(result.beads, 'BEAD-004')?.wave_index).toBe(3)
      expect(beadById(result.beads, 'BEAD-006')?.wave_index).toBe(3)
      expect(beadById(result.beads, 'BEAD-008')?.wave_index).toBe(3)
      // Wave 4: BEAD-005 (depends on 004)
      expect(beadById(result.beads, 'BEAD-005')?.wave_index).toBe(4)
      // Wave 5: BEAD-007 (depends on 004, 005, 006)
      expect(beadById(result.beads, 'BEAD-007')?.wave_index).toBe(5)
    })

    it('produces correct number of waves', () => {
      const result = parsePlanMarkdown(planRunnerMd)
      expect(result.waveCount).toBe(6)
      expect(result.waves).toHaveLength(6)
    })

    it('groups beads correctly in waves', () => {
      const result = parsePlanMarkdown(planRunnerMd)
      expect(result.waves[0].map((b) => b.id)).toEqual(['BEAD-001'])
      expect(result.waves[1].map((b) => b.id)).toEqual(['BEAD-002'])
      expect(result.waves[2].map((b) => b.id)).toEqual(['BEAD-003'])
      expect(result.waves[3].map((b) => b.id).sort()).toEqual(['BEAD-004', 'BEAD-006', 'BEAD-008'])
      expect(result.waves[4].map((b) => b.id)).toEqual(['BEAD-005'])
      expect(result.waves[5].map((b) => b.id)).toEqual(['BEAD-007'])
    })

    it('extracts sizes correctly', () => {
      const result = parsePlanMarkdown(planRunnerMd)
      expect(beadById(result.beads, 'BEAD-001')?.size).toBe('S')
      expect(beadById(result.beads, 'BEAD-002')?.size).toBe('M')
      expect(beadById(result.beads, 'BEAD-003')?.size).toBe('L')
      expect(beadById(result.beads, 'BEAD-005')?.size).toBe('S')
      expect(beadById(result.beads, 'BEAD-008')?.size).toBe('S')
    })

    it('extracts files for each bead', () => {
      const result = parsePlanMarkdown(planRunnerMd)
      expect(beadById(result.beads, 'BEAD-002')?.files).toContain('lib/plan-parser.ts')
      expect(beadById(result.beads, 'BEAD-002')?.files).toContain('lib/__tests__/plan-parser.test.ts')
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles beads with unresolved dependency IDs gracefully', () => {
      // If a bead depends on a bead that does not exist, it should still
      // be treated as having no (known) dependency. Or we could treat it
      // as wave 0. The key is: don't crash.
      const md = [
        '# Plan',
        '### BEAD-002: Orphan',
        '- **Depends on:** 999',
      ].join('\n')
      // Should not throw — graceful handling
      const result = parsePlanMarkdown(md)
      expect(result.beads).toHaveLength(1)
      // Unknown dep is silently ignored for wave computation
      expect(result.beads[0].wave_index).toBe(0)
    })

    it('handles bare bead IDs without BEAD- prefix in depends', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Root',
        '- **Depends on:** none',
        '### BEAD-002: Child',
        '- **Depends on:** BEAD-001',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[1].dependencies).toEqual(['BEAD-001'])
      expect(result.beads[1].wave_index).toBe(1)
    })

    it('trims whitespace in field values', () => {
      const md = [
        '# Plan',
        '### BEAD-001: Task',
        '- **Size:**   L  ',
        '- **Domain:**   operations  ',
        '- **Model:**   opus  ',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads[0].size).toBe('L')
      expect(result.beads[0].domain).toBe('operations')
      expect(result.beads[0].model).toBe('opus')
    })

    it('ignores non-bead ### headers', () => {
      const md = [
        '# Plan',
        '### Context',
        'Some context info.',
        '### BEAD-001: Real bead',
        'Content.',
        '### Notes',
        'Some notes.',
      ].join('\n')
      const result = parsePlanMarkdown(md)
      expect(result.beads).toHaveLength(1)
      expect(result.beads[0].id).toBe('BEAD-001')
    })

    it('handles three-way cycle detection', () => {
      const md = [
        '# Plan',
        '### BEAD-001: A',
        '- **Depends on:** 003',
        '### BEAD-002: B',
        '- **Depends on:** 001',
        '### BEAD-003: C',
        '- **Depends on:** 002',
      ].join('\n')
      expect(() => parsePlanMarkdown(md)).toThrow(/cycle/i)
    })
  })
})
