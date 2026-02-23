/**
 * POST /api/folio/populate
 *
 * Trigger endpoint that runs the Folio population logic inline.
 * Scans ~/Code for git repos and upserts project records via Supabase service client.
 *
 * Auth: requires x-api-key header matching CRON_SECRET env var.
 * Body: { dryRun?: boolean }
 */

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { execSync } from 'child_process'
import { readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'

const CODE_DIR = resolve(homedir(), 'Code')

// ---------------------------------------------------------------------------
// Git helpers (same logic as scripts/populate-folio.ts)
// ---------------------------------------------------------------------------

function run(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function inferFileTypes(cwd: string): string[] {
  const out = run('git log --oneline -50 --name-only --pretty=format:', cwd)
  const lines = out.split('\n').filter(l => l.includes('.'))
  const extCounts: Record<string, number> = {}
  for (const line of lines) {
    const match = line.match(/\.(\w+)$/)
    if (match) {
      const ext = match[1].toLowerCase()
      extCounts[ext] = (extCounts[ext] ?? 0) + 1
    }
  }
  return Object.entries(extCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ext]) => ext)
}

function inferProjectType(name: string, fileTypes: string[]): string {
  const n = name.toLowerCase()
  if (n.includes('bot') || n.includes('agent') || n.includes('clawd')) return 'agent'
  if (n.includes('api') || n.includes('server') || n.includes('engine')) return 'infrastructure'
  if (n.includes('research') || n.includes('science') || n.includes('jack')) return 'research'
  if (n.includes('landing') || n.includes('onboarding') || n.includes('marketing')) return 'marketing'
  if (fileTypes.includes('py')) return 'python'
  if (fileTypes.includes('ts') || fileTypes.includes('tsx')) return 'product'
  return 'project'
}

function inferStatus(lastCommitDate: string | null, commitCount: number): 'inprogress' | 'queue' | 'onhold' | 'done' {
  if (!lastCommitDate) return 'onhold'
  const daysSince = (Date.now() - new Date(lastCommitDate).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince < 14) return 'inprogress'
  if (daysSince < 60) return 'queue'
  if (commitCount < 3) return 'done'
  return 'onhold'
}

function analyzeRepo(name: string, repoPath: string) {
  const lastCommitDate = run('git log -1 --format=%ci', repoPath) || null
  const logLines = run('git log --oneline -50', repoPath)
  const lines = logLines ? logLines.split('\n').filter(Boolean) : []
  const commitCount = lines.length

  if (commitCount === 0) return null

  const recentMessages = lines
    .slice(0, 10)
    .map(l => l.replace(/^[a-f0-9]+ /, '').trim())

  const dominantFileTypes = inferFileTypes(repoPath)
  const inferredType = inferProjectType(name, dominantFileTypes)
  const inferredStatus = inferStatus(lastCommitDate, commitCount)

  const meaningful = recentMessages
    .filter(m => m.length > 5 && !m.startsWith('wip') && !m.startsWith('tmp'))
    .slice(0, 3)
  const langHint = dominantFileTypes.slice(0, 2).join(', ')
  const goal = meaningful.length > 0
    ? `Recent work: ${meaningful.join('; ')}.`
    : `Git repo with ${langHint || 'mixed'} files.`

  return {
    id: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    title: name,
    status: inferredStatus,
    type: inferredType,
    owner: 'sensei',
    goal,
    notes: [
      `Path: ~/Code/${name}`,
      `File types: ${dominantFileTypes.join(', ') || 'unknown'}`,
      `Commits analyzed: ${commitCount}`,
      lastCommitDate ? `Last commit: ${lastCommitDate.slice(0, 10)}` : null,
    ].filter(Boolean).join('\n'),
    priority: inferredStatus === 'inprogress' ? 20 : inferredStatus === 'queue' ? 40 : 80,
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Simple auth guard — use CRON_SECRET or any shared secret
  const apiKey = req.headers.get('x-api-key')
  const secret = process.env.CRON_SECRET
  if (secret && apiKey !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let dryRun = false
  try {
    const body = await req.json()
    dryRun = body?.dryRun === true
  } catch {
    // body is optional
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return Response.json({ error: 'Supabase service client unavailable' }, { status: 500 })
  }

  const results: Array<{ name: string; id: string; status: string; error?: string }> = []

  let entries: string[]
  try {
    entries = readdirSync(CODE_DIR)
  } catch (err) {
    return Response.json({ error: `Cannot read ${CODE_DIR}`, detail: String(err) }, { status: 500 })
  }

  for (const entry of entries) {
    const fullPath = resolve(CODE_DIR, entry)
    try {
      if (!statSync(fullPath).isDirectory()) continue
      statSync(resolve(fullPath, '.git')) // throws if no .git
    } catch {
      continue
    }

    const record = analyzeRepo(entry, fullPath)
    if (!record) continue

    if (dryRun) {
      results.push({ name: entry, id: record.id, status: 'dry-run' })
      continue
    }

    const { error } = await supabase
      .from('projects')
      .upsert(record, { onConflict: 'id' })

    results.push({
      name: entry,
      id: record.id,
      status: error ? 'error' : 'upserted',
      ...(error ? { error: error.message } : {}),
    })
  }

  const upserted = results.filter(r => r.status === 'upserted').length
  const failed = results.filter(r => r.status === 'error').length

  return Response.json({
    ok: true,
    dryRun,
    total: results.length,
    upserted,
    failed,
    results,
  })
}
