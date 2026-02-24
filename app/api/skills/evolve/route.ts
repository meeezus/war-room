import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

// POST /api/skills/evolve
// Manual trigger for cross-pollination via Makima.
// Identifies skill_patches shared across 2+ agents and propagates fleet-wide.
// Returns { patterns: [...], count: number }
export async function POST(_req: NextRequest) {
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Service client unavailable' }, { status: 500 })
  }

  // Load recent patches (last 30 days, confidence > 0.6, not yet applied)
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: patches, error } = await sb
    .from('skill_patches')
    .select('id, agent_id, patch_type, content, confidence')
    .gt('confidence', 0.6)
    .gt('created_at', cutoff)
    .eq('applied', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!patches || patches.length === 0) {
    return NextResponse.json({ patterns: [], count: 0 })
  }

  // Group by similarity — simple exact-match clustering on lowercased content
  // (full cosine dedup lives in the Python engine; here we cluster by shared substrings)
  type Patch = { id: string; agent_id: string; patch_type: string; content: string; confidence: number }
  const patchList = patches as Patch[]

  function similarity(a: string, b: string): number {
    const la = a.toLowerCase()
    const lb = b.toLowerCase()
    if (la === lb) return 1
    // Jaccard on word sets
    const wa = new Set(la.split(/\s+/))
    const wb = new Set(lb.split(/\s+/))
    const intersection = [...wa].filter(w => wb.has(w)).length
    const union = new Set([...wa, ...wb]).size
    return union === 0 ? 0 : intersection / union
  }

  const THRESHOLD = 0.6
  const clusters: Patch[][] = []

  for (const patch of patchList) {
    let placed = false
    for (const cluster of clusters) {
      if (similarity(patch.content, cluster[0].content) >= THRESHOLD) {
        cluster.push(patch)
        placed = true
        break
      }
    }
    if (!placed) clusters.push([patch])
  }

  // Find clusters with 2+ distinct agents
  const fleetPatterns: Array<{
    source_agents: string[]
    pattern: string
    patch_type: string
    cluster_size: number
  }> = []

  for (const cluster of clusters) {
    const agentSet = new Set(cluster.map(p => p.agent_id))
    if (agentSet.size < 2) continue

    const canonical = cluster.reduce((best, p) => p.confidence > best.confidence ? p : best)
    fleetPatterns.push({
      source_agents: [...agentSet],
      pattern: canonical.content,
      patch_type: canonical.patch_type,
      cluster_size: cluster.length,
    })
  }

  // Emit cross_pollination event to war_room_events
  if (fleetPatterns.length > 0) {
    await sb.from('war_room_events').insert({
      event_type: 'cross_pollination',
      agent_id: 'makima',
      title: 'Cross-Pollination',
      description: `Makima identified ${fleetPatterns.length} fleet-wide pattern(s) across agents`,
      metadata: {
        agent: 'makima',
        pattern_count: fleetPatterns.length,
        patterns: fleetPatterns,
        message: `Fleet patterns found: ${fleetPatterns.map(p => p.pattern.slice(0, 60)).join('; ')}`,
      },
      created_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({ patterns: fleetPatterns, count: fleetPatterns.length })
}
