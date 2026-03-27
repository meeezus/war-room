#!/usr/bin/env node
/**
 * Seed research_findings with curated AI/agent news so the Research card
 * has data immediately while we wait for BRAVE_API_KEY setup.
 *
 * Run: node scripts/seed-research-findings.mjs
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const SEED_FINDINGS = [
  {
    source: 'manual',
    title: 'Claude Code introduces background agents and parallel task execution',
    summary: 'Anthropic shipped multi-agent orchestration in Claude Code, enabling background agents that run tasks in parallel while the user continues working. Supports model selection per agent.',
    url: 'https://docs.anthropic.com/en/docs/claude-code',
    relevance: 'high',
    tags: ['claude', 'agents', 'coding'],
    metadata: { curated: true, topic: 'Claude Code' },
  },
  {
    source: 'manual',
    title: 'Model Context Protocol (MCP) reaches 1.0 — standard for tool integration',
    summary: 'MCP hit its 1.0 milestone with broad adoption across AI coding assistants. Standardizes how LLMs connect to external tools, databases, and APIs.',
    url: 'https://modelcontextprotocol.io',
    relevance: 'high',
    tags: ['mcp', 'protocol', 'tools'],
    metadata: { curated: true, topic: 'MCP' },
  },
  {
    source: 'manual',
    title: 'Doodlestein agent flywheel: recursive self-improvement through skill files',
    summary: 'Jeffrey Emanuel published agent_flywheel framework showing how to build in-context recursive self-improvement loops. Skills learn from session outcomes and evolve automatically.',
    url: 'https://github.com/Dicklesworthstone/agent_flywheel_clawdbot_skills_and_integrations',
    relevance: 'high',
    tags: ['agents', 'flywheel', 'self-improvement'],
    metadata: { curated: true, topic: 'Agent Architecture' },
  },
  {
    source: 'manual',
    title: 'Paperclip AI: open-source agent governance dashboard with board of directors model',
    summary: 'Paperclip AI (30K GitHub stars) implements agent company governance — board of directors, budget controls, ticket system, org chart. Node.js + React stack.',
    url: 'https://github.com/PaperclipAI/paperclip',
    relevance: 'medium',
    tags: ['governance', 'dashboard', 'agents'],
    metadata: { curated: true, topic: 'Agent Governance' },
  },
  {
    source: 'manual',
    title: 'OpenSpace by HKUDS: auto-fix, auto-improve, auto-learn skill system',
    summary: 'OpenSpace closes the flywheel loop for skill evolution — automatically delegates tasks, discovers new skills, and improves existing ones based on execution outcomes.',
    url: 'https://github.com/HKUDS/OpenSpace',
    relevance: 'medium',
    tags: ['openspace', 'skills', 'automation'],
    metadata: { curated: true, topic: 'Skill Evolution' },
  },
  {
    source: 'manual',
    title: 'Brave Search API: structured web search for AI agents at scale',
    summary: 'Brave Search offers a developer API with freshness filters, structured JSON responses, and MCP integration — ideal for automated research pipelines.',
    url: 'https://brave.com/search/api/',
    relevance: 'medium',
    tags: ['brave', 'search', 'api'],
    metadata: { curated: true, topic: 'Research Infrastructure' },
  },
  {
    source: 'manual',
    title: 'Agentic coding: from copilot to autonomous developer workflows',
    summary: 'The shift from AI code completion to autonomous agentic coding is accelerating. Claude Code, Cursor, Windsurf, and others now support multi-step autonomous task execution.',
    url: 'https://www.anthropic.com/research/swe-bench-sonnet',
    relevance: 'high',
    tags: ['agentic', 'coding', 'autonomous'],
    metadata: { curated: true, topic: 'Agentic Coding' },
  },
]

async function seed() {
  console.log('Seeding research_findings...')
  let inserted = 0

  for (const finding of SEED_FINDINGS) {
    // Dedup by URL
    const { count } = await supabase
      .from('research_findings')
      .select('id', { count: 'exact', head: true })
      .eq('url', finding.url)

    if (count > 0) {
      console.log(`  ~ Already exists: ${finding.title.slice(0, 50)}...`)
      continue
    }

    const { error } = await supabase.from('research_findings').insert(finding)

    if (!error) {
      inserted++
      console.log(`  + ${finding.title.slice(0, 60)}...`)
    } else {
      console.error(`  ! ${error.message}`)
    }
  }

  console.log(`\nSeeded ${inserted} of ${SEED_FINDINGS.length} findings`)

  if (inserted > 0) {
    await supabase.from('war_room_events').insert({
      event_type: 'research_scan_complete',
      agent_id: 'system',
      title: `Research seed: ${inserted} curated findings`,
      metadata: { count: inserted, source: 'manual_seed' },
    })
    console.log('Event emitted.')
  }
}

seed().catch(console.error)
