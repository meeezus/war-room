#!/usr/bin/env node
/**
 * Research Scanner — finds relevant AI/tech news via Brave Search
 * and stores in research_findings table.
 *
 * Run: node scripts/research-scan.mjs
 * Cron: weekly via Vercel cron at /api/cron/research-scan
 *
 * Requires: BRAVE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Search topics relevant to Sensei's work
const TOPICS = [
  'Claude Code AI coding assistant 2026',
  'AI agent frameworks autonomous coding',
  'MCP model context protocol tools',
  'self-improving AI agents recursive',
  'agentic coding workflow automation',
]

async function searchBrave(query) {
  const key = process.env.BRAVE_API_KEY
  if (!key) {
    return []
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&freshness=pw`
  try {
    const res = await fetch(url, {
      headers: { 'X-Subscription-Token': key, Accept: 'application/json' },
    })

    if (!res.ok) {
      console.error(`Brave search failed: ${res.status}`)
      return []
    }

    const data = await res.json()
    return (data.web?.results || []).map((r) => ({
      source: 'brave',
      title: r.title,
      summary: r.description,
      url: r.url,
      relevance: 'medium',
      tags: [query.split(' ')[0].toLowerCase()],
      metadata: { query, age: r.age },
    }))
  } catch (err) {
    console.error(`Brave search error: ${err.message}`)
    return []
  }
}

async function run() {
  console.log('Research scan starting...')
  let totalInserted = 0
  const seenUrls = new Set()

  for (const topic of TOPICS) {
    const results = await searchBrave(topic)

    for (const finding of results) {
      if (!finding.url) continue

      // Dedup within batch
      if (seenUrls.has(finding.url)) continue
      seenUrls.add(finding.url)

      // Dedup against DB
      const { count } = await supabase
        .from('research_findings')
        .select('id', { count: 'exact', head: true })
        .eq('url', finding.url)

      if (count > 0) continue

      const { error } = await supabase.from('research_findings').insert(finding)

      if (!error) {
        totalInserted++
        console.log(`  + ${finding.title.slice(0, 60)}...`)
      } else {
        console.error(`  ! Insert failed: ${error.message}`)
      }
    }
  }

  console.log(`Research scan complete: ${totalInserted} new findings`)

  // Emit event
  if (totalInserted > 0) {
    await supabase.from('war_room_events').insert({
      event_type: 'research_scan_complete',
      agent_id: 'system',
      title: `Research scan: ${totalInserted} new findings`,
      metadata: { count: totalInserted, topics: TOPICS.length },
    })
  }
}

run().catch(console.error)
