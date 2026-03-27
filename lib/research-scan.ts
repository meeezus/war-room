/**
 * Research Scanner — searches Brave for AI/agent news and stores findings
 * in the research_findings table.
 *
 * Used by:
 * - scripts/research-scan.mjs (standalone CLI)
 * - app/api/cron/research-scan/route.ts (Vercel cron)
 */

import { createServiceClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

const log = logger('research-scan')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResearchFinding {
  source: string
  title: string
  summary: string
  url: string | null
  relevance: string
  tags: string[]
  metadata: Record<string, unknown>
}

export interface ScanResult {
  inserted: number
  topicsSearched: number
}

// ---------------------------------------------------------------------------
// Search topics — curated for Sensei's interests
// ---------------------------------------------------------------------------

export const RESEARCH_TOPICS: string[] = [
  'Claude Code AI coding assistant 2026',
  'AI agent frameworks autonomous coding',
  'MCP model context protocol tools',
  'self-improving AI agents recursive',
  'agentic coding workflow automation',
]

// ---------------------------------------------------------------------------
// Brave Search
// ---------------------------------------------------------------------------

export async function searchBrave(query: string): Promise<ResearchFinding[]> {
  const key = process.env.BRAVE_API_KEY
  if (!key) {
    return []
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&freshness=pw`

  try {
    const res = await fetch(url, {
      headers: {
        'X-Subscription-Token': key,
        'Accept': 'application/json',
      },
    })

    if (!res.ok) {
      log.warn('Brave search failed', { status: res.status, query })
      return []
    }

    const data = await res.json()
    const results = data.web?.results || []

    return results.map((r: { title: string; description: string; url: string; age?: string }) => ({
      source: 'brave',
      title: r.title,
      summary: r.description,
      url: r.url,
      relevance: 'medium',
      tags: [query.split(' ')[0].toLowerCase()],
      metadata: { query, age: r.age },
    }))
  } catch (err) {
    log.error('Brave search error', err, { query })
    return []
  }
}

// ---------------------------------------------------------------------------
// Deduplication — checks against existing URLs in research_findings + batch
// ---------------------------------------------------------------------------

export async function deduplicateFindings(findings: ResearchFinding[]): Promise<ResearchFinding[]> {
  const sb = createServiceClient()
  const seen = new Set<string>()
  const unique: ResearchFinding[] = []

  for (const finding of findings) {
    // No URL = can't dedup, keep it
    if (!finding.url) {
      unique.push(finding)
      continue
    }

    // Dedup within batch
    if (seen.has(finding.url)) continue
    seen.add(finding.url)

    // Dedup against database
    if (sb) {
      try {
        const { count } = await sb
          .from('research_findings')
          .select('id', { count: 'exact', head: true })
          .eq('url', finding.url)

        if ((count ?? 0) > 0) continue
      } catch {
        // If check fails, keep the finding (insert may still fail on unique constraint)
      }
    }

    unique.push(finding)
  }

  return unique
}

// ---------------------------------------------------------------------------
// Insert findings
// ---------------------------------------------------------------------------

export async function insertFindings(findings: ResearchFinding[]): Promise<number> {
  if (findings.length === 0) return 0

  const sb = createServiceClient()
  if (!sb) return 0

  const { error } = await sb.from('research_findings').insert(findings)

  if (error) {
    log.error('Insert findings failed', error)
    return 0
  }

  return findings.length
}

// ---------------------------------------------------------------------------
// Full scan orchestrator
// ---------------------------------------------------------------------------

export async function runResearchScan(): Promise<ScanResult> {
  log.info('Research scan starting', { topics: RESEARCH_TOPICS.length })

  // Search all topics
  const allFindings: ResearchFinding[] = []
  for (const topic of RESEARCH_TOPICS) {
    const results = await searchBrave(topic)
    allFindings.push(...results)
  }

  // Deduplicate against existing + within batch
  const unique = await deduplicateFindings(allFindings)

  // Insert
  const inserted = await insertFindings(unique)

  log.info('Research scan complete', { inserted, total: allFindings.length, unique: unique.length })

  // Emit event if findings were inserted
  if (inserted > 0) {
    const sb = createServiceClient()
    if (sb) {
      try {
        await sb.from('war_room_events').insert({
          event_type: 'research_scan_complete',
          agent_id: 'system',
          title: `Research scan: ${inserted} new findings`,
          metadata: { count: inserted, topics: RESEARCH_TOPICS.length },
        })
      } catch (err) {
        log.error('Failed to emit scan event', err)
      }
    }
  }

  return { inserted, topicsSearched: RESEARCH_TOPICS.length }
}
