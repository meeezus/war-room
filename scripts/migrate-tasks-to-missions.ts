/**
 * One-time migration: backfill proposals + missions for existing tasks.
 *
 * For each task:
 *   - If task has no proposal_id -> create proposal + mission, link task
 *   - If task has proposal_id but no mission exists -> create mission from proposal
 *   - If task already has proposal + mission -> skip (idempotent)
 *
 * Usage:
 *   npx tsx scripts/migrate-tasks-to-missions.ts
 *   npx tsx scripts/migrate-tasks-to-missions.ts --dry-run
 */

import dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DRY_RUN = process.argv.includes('--dry-run')

// ---------------------------------------------------------------------------
// Status mapping: task status -> mission status
// ---------------------------------------------------------------------------

type TaskStatus = 'todo' | 'assigned' | 'in_progress' | 'review' | 'done' | 'someday' | 'blocked'
type MissionStatus = 'queued' | 'running' | 'completed' | 'failed'

const STATUS_MAP: Record<TaskStatus, MissionStatus> = {
  todo: 'queued',
  assigned: 'queued',
  in_progress: 'running',
  review: 'completed',
  done: 'completed',
  blocked: 'failed',
  someday: 'queued',
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n--- migrate-tasks-to-missions ${DRY_RUN ? '(DRY RUN)' : ''} ---\n`)

  // 1. Fetch all tasks
  const { data: tasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true })

  if (tasksErr) {
    console.error('Failed to fetch tasks:', tasksErr.message)
    process.exit(1)
  }

  if (!tasks || tasks.length === 0) {
    console.log('No tasks found. Nothing to migrate.')
    return
  }

  console.log(`Found ${tasks.length} task(s) total.\n`)

  // 2. Pre-fetch existing missions keyed by proposal_id for idempotency check
  const { data: existingMissions, error: missionsErr } = await supabase
    .from('missions')
    .select('id, proposal_id')
    .not('proposal_id', 'is', null)

  if (missionsErr) {
    console.error('Failed to fetch existing missions:', missionsErr.message)
    process.exit(1)
  }

  const missionByProposalId = new Set(
    (existingMissions ?? []).map((m: { proposal_id: string }) => m.proposal_id)
  )

  let created = 0
  let skipped = 0
  let missionOnly = 0
  let errors = 0

  for (const task of tasks) {
    const label = `[task #${task.id}] "${task.title}"`

    // Case 1: Task already has proposal + mission -> skip
    if (task.proposal_id && missionByProposalId.has(task.proposal_id)) {
      console.log(`  SKIP  ${label} (already has proposal + mission)`)
      skipped++
      continue
    }

    // Case 2: Task has proposal_id but no mission -> create mission only
    if (task.proposal_id && !missionByProposalId.has(task.proposal_id)) {
      console.log(`  MISSION-ONLY  ${label} (has proposal ${task.proposal_id}, needs mission)`)

      if (!DRY_RUN) {
        const missionStatus = STATUS_MAP[task.status as TaskStatus] ?? 'queued'
        const { data: mission, error: missionErr } = await supabase
          .from('missions')
          .insert({
            proposal_id: task.proposal_id,
            title: task.title,
            assigned_to: task.owner || 'ed',
            status: missionStatus,
            started_at: missionStatus === 'running' ? new Date().toISOString() : null,
            completed_at: missionStatus === 'completed' ? (task.completed_at || new Date().toISOString()) : null,
          })
          .select('id')
          .single()

        if (missionErr) {
          console.error(`    ERROR creating mission: ${missionErr.message}`)
          errors++
          continue
        }

        missionByProposalId.add(task.proposal_id)
        console.log(`    -> mission ${mission.id} (${missionStatus})`)
      }

      missionOnly++
      continue
    }

    // Case 3: Task has no proposal_id -> create proposal + mission + link task
    console.log(`  CREATE  ${label}`)

    if (!DRY_RUN) {
      // 3a. Create proposal
      const { data: proposal, error: proposalErr } = await supabase
        .from('proposals')
        .insert({
          title: task.title,
          description: task.goal || null,
          source: 'manual' as const,
          requested_by: task.owner || 'sensei',
          project_id: task.project_id,
          status: 'approved' as const,
          approved_at: new Date().toISOString(),
          approved_by: 'migration',
          auto_approved: true,
          council_review: false,
          reviews: [],
        })
        .select('id')
        .single()

      if (proposalErr) {
        console.error(`    ERROR creating proposal: ${proposalErr.message}`)
        errors++
        continue
      }

      // 3b. Create mission
      const missionStatus = STATUS_MAP[task.status as TaskStatus] ?? 'queued'
      const { data: mission, error: missionErr } = await supabase
        .from('missions')
        .insert({
          proposal_id: proposal.id,
          title: task.title,
          assigned_to: task.owner || 'ed',
          status: missionStatus,
          started_at: missionStatus === 'running' ? new Date().toISOString() : null,
          completed_at: missionStatus === 'completed' ? (task.completed_at || new Date().toISOString()) : null,
        })
        .select('id')
        .single()

      if (missionErr) {
        console.error(`    ERROR creating mission: ${missionErr.message}`)
        errors++
        continue
      }

      // 3c. Link task back to proposal
      const { error: linkErr } = await supabase
        .from('tasks')
        .update({ proposal_id: proposal.id })
        .eq('id', task.id)

      if (linkErr) {
        console.error(`    ERROR linking task to proposal: ${linkErr.message}`)
        errors++
        continue
      }

      missionByProposalId.add(proposal.id)
      console.log(`    -> proposal ${proposal.id}, mission ${mission.id} (${missionStatus})`)
    }

    created++
  }

  console.log(`\n--- Summary ---`)
  console.log(`  Created (proposal + mission): ${created}`)
  console.log(`  Mission-only:                 ${missionOnly}`)
  console.log(`  Skipped (already migrated):   ${skipped}`)
  console.log(`  Errors:                       ${errors}`)
  console.log(`  Total tasks:                  ${tasks.length}`)
  if (DRY_RUN) console.log(`\n  (DRY RUN - no changes written)\n`)
  else console.log('')
}

main().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
