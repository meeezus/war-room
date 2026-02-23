/**
 * populate-folio.ts
 *
 * Scans ~/Code for git repos, analyzes recent history, and upserts
 * Folio project entries into Supabase.
 *
 * Usage:
 *   npx tsx scripts/populate-folio.ts
 *   npx tsx scripts/populate-folio.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { execSync } from 'child_process'
import { readdirSync, statSync } from 'fs'
import { homedir } from 'os'

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const CODE_DIR = resolve(homedir(), 'Code')
const DRY_RUN = process.argv.includes('--dry-run')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RepoSummary {
  name: string
  path: string
  lastCommitDate: string | null
  commitCount: number
  recentMessages: string[]
  dominantFileTypes: string[]
  inferredType: string
  inferredStatus: 'inprogress' | 'queue' | 'onhold' | 'done'
  goal: string
}

// ---------------------------------------------------------------------------
// Helpers
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
  const nameLower = name.toLowerCase()
  if (nameLower.includes('bot') || nameLower.includes('agent') || nameLower.includes('clawd')) return 'agent'
  if (nameLower.includes('api') || nameLower.includes('server') || nameLower.includes('engine')) return 'infrastructure'
  if (nameLower.includes('research') || nameLower.includes('science') || nameLower.includes('jack')) return 'research'
  if (nameLower.includes('landing') || nameLower.includes('onboarding') || nameLower.includes('marketing')) return 'marketing'
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

function buildGoal(name: string, messages: string[], fileTypes: string[]): string {
  // Use the 3 most recent meaningful commit messages as a work summary
  const meaningful = messages
    .filter(m => m.length > 5 && !m.startsWith('wip') && !m.startsWith('tmp'))
    .slice(0, 3)

  const langHint = fileTypes.slice(0, 2).join(', ')
  const base = meaningful.length > 0
    ? `Recent work: ${meaningful.join('; ')}.`
    : `Git repo with ${langHint || 'mixed'} files.`

  return base
}

// ---------------------------------------------------------------------------
// Core: analyze a single repo
// ---------------------------------------------------------------------------

function analyzeRepo(name: string, repoPath: string): RepoSummary | null {
  // Last commit date
  const lastCommitDate = run('git log -1 --format=%ci', repoPath) || null

  // Commit count (last 50 = quick proxy)
  const logLines = run('git log --oneline -50', repoPath)
  const lines = logLines ? logLines.split('\n').filter(Boolean) : []
  const commitCount = lines.length

  if (commitCount === 0) return null // empty repo, skip

  // Recent commit messages (strip hash prefix)
  const recentMessages = lines
    .slice(0, 10)
    .map(l => l.replace(/^[a-f0-9]+ /, '').trim())

  const dominantFileTypes = inferFileTypes(repoPath)
  const inferredType = inferProjectType(name, dominantFileTypes)
  const inferredStatus = inferStatus(lastCommitDate, commitCount)
  const goal = buildGoal(name, recentMessages, dominantFileTypes)

  return {
    name,
    path: repoPath,
    lastCommitDate,
    commitCount,
    recentMessages,
    dominantFileTypes,
    inferredType,
    inferredStatus,
    goal,
  }
}

// ---------------------------------------------------------------------------
// Core: discover repos
// ---------------------------------------------------------------------------

function discoverRepos(): RepoSummary[] {
  const entries = readdirSync(CODE_DIR)
  const summaries: RepoSummary[] = []

  for (const entry of entries) {
    const fullPath = resolve(CODE_DIR, entry)
    try {
      const stat = statSync(fullPath)
      if (!stat.isDirectory()) continue
      const gitDir = resolve(fullPath, '.git')
      try {
        statSync(gitDir)
      } catch {
        continue // no .git directory
      }

      const summary = analyzeRepo(entry, fullPath)
      if (summary) {
        summaries.push(summary)
        console.log(`  ✓ ${entry} — ${summary.commitCount} commits, last: ${summary.lastCommitDate?.slice(0, 10) ?? 'unknown'}, status: ${summary.inferredStatus}`)
      } else {
        console.log(`  — ${entry} (empty, skipped)`)
      }
    } catch {
      // skip unreadable entries
    }
  }

  return summaries
}

// ---------------------------------------------------------------------------
// Core: upsert to Supabase
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertProject(
  supabase: ReturnType<typeof createClient<any>>,
  repo: RepoSummary
): Promise<boolean> {
  // Use repo name as stable ID (lowercased, hyphenated)
  const id = repo.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')

  const record = {
    id,
    title: repo.name,
    status: repo.inferredStatus,
    type: repo.inferredType,
    owner: 'sensei',
    goal: repo.goal,
    notes: [
      `Path: ~/Code/${repo.name}`,
      `File types: ${repo.dominantFileTypes.join(', ') || 'unknown'}`,
      `Commits analyzed: ${repo.commitCount}`,
      repo.lastCommitDate ? `Last commit: ${repo.lastCommitDate.slice(0, 10)}` : null,
    ].filter(Boolean).join('\n'),
    priority: repo.inferredStatus === 'inprogress' ? 20 : repo.inferredStatus === 'queue' ? 40 : 80,
  }

  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would upsert: ${id}`, record)
    return true
  }

  const { error } = await supabase
    .from('projects')
    .upsert(record, { onConflict: 'id' })

  if (error) {
    console.error(`    ERROR upserting ${id}:`, error.message)
    return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Folio population script`)
  console.log(`Code dir: ${CODE_DIR}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log(`\nDiscovering repos...`)

  const repos = discoverRepos()
  console.log(`\nFound ${repos.length} repos with commit history\n`)

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient<any>(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let upserted = 0
  let failed = 0

  for (const repo of repos) {
    process.stdout.write(`  Upserting: ${repo.name}... `)
    const ok = await upsertProject(supabase, repo)
    if (ok) {
      upserted++
      console.log('ok')
    } else {
      failed++
      console.log('FAILED')
    }
  }

  console.log(`\nDone. ${upserted} upserted, ${failed} failed.`)
  if (DRY_RUN) console.log('(dry run — no changes written)')
  process.exit(failed > 0 ? 1 : 0)
}

main()
