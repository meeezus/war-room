#!/usr/bin/env node
// Run with: cd ~/Code/war-room && npx tsx scripts/reset-dynasty.ts
//
// Resets dynasty data:
//   1. Deletes all missions
//   2. Deletes all existing projects (and dependent boards/tasks)
//   3. Inserts 4 fresh projects: Folio, Ajack, AOM, Dynasty
//   4. Updates project status constraint to match app types

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const FRESH_PROJECTS = [
  {
    id: 'folio',
    title: 'Folio',
    status: 'inprogress',
    priority: 0,
    goal: 'Research platform for health creators',
    type: 'product',
    owner: 'Development',
    notes: 'SaaS for health influencers. Jack Schroder is Client Zero.',
    next_action: 'Continue sprint work',
  },
  {
    id: 'ajack',
    title: 'Ajack',
    status: 'queue',
    priority: 1,
    goal: 'Agentic Jack: 24/7 AI chat for Jack\'s community',
    type: 'product',
    owner: 'Development',
    notes: 'Community-facing AI chatbot trained on Jack\'s content and research.',
    next_action: 'Define MVP scope',
  },
  {
    id: 'aeom',
    title: '\u00C6OM',
    status: 'inprogress',
    priority: 1,
    goal: 'Agency landing page',
    type: 'project',
    owner: 'Michael',
    notes: 'Marketing website and online presence for the agency.',
    next_action: 'Draft landing page design',
  },
  {
    id: 'dynasty',
    title: 'Dynasty',
    status: 'inprogress',
    priority: 0,
    goal: 'The Shogunate command system',
    type: 'strategy',
    owner: 'Michael',
    notes: 'War Room dashboard, mission control, agent coordination.',
    next_action: 'Complete Awakening Sprint 1',
  },
]

async function deleteAll(table: string) {
  // Supabase requires a filter for delete — use gte on created_at which every table has
  const { error } = await sb
    .from(table)
    .delete()
    .gte('created_at', '1970-01-01')
  if (error) {
    console.error(`  Failed to delete from ${table}: ${error.message}`)
    return false
  }
  console.log(`  ${table} cleared.`)
  return true
}

async function nullifyFk(table: string, column: string) {
  const { error } = await sb
    .from(table)
    .update({ [column]: null })
    .not(column, 'is', null)
  if (error) {
    console.error(`  Failed to nullify ${table}.${column}: ${error.message}`)
    return false
  }
  console.log(`  ${table}.${column} nullified.`)
  return true
}

async function main() {
  console.log('=== Dynasty Data Reset ===\n')

  // Step 1: Clear FK references to missions
  // steps.mission_id -> missions, agent_memory.source_mission_id -> missions, tasks.mission_id -> missions
  console.log('1. Clearing FK references to missions...')
  await deleteAll('steps')
  await nullifyFk('agent_memory', 'source_mission_id')
  await nullifyFk('tasks', 'mission_id')
  await nullifyFk('agent_status', 'current_mission_id')

  // Step 2: Delete all missions
  console.log('\n2. Deleting all missions...')
  await deleteAll('missions')

  // Step 3: Clear FK references to projects
  // proposals.project_id -> projects, boards.project_id -> projects, tasks.project_id -> projects, missions.project_id -> projects
  console.log('\n3. Clearing FK references to projects...')
  await nullifyFk('proposals', 'project_id')
  await nullifyFk('missions', 'project_id')
  await deleteAll('tasks')
  await deleteAll('boards')

  // Step 4: Delete all existing projects
  console.log('\n4. Deleting all existing projects...')
  const ok = await deleteAll('projects')
  if (!ok) {
    console.error('Cannot continue without clearing projects.')
    process.exit(1)
  }

  // Step 5: Insert fresh projects
  console.log('\n5. Inserting fresh projects...')
  const { data: inserted, error: insertErr } = await sb
    .from('projects')
    .insert(FRESH_PROJECTS)
    .select()

  if (insertErr) {
    if (insertErr.message.includes('check') || insertErr.message.includes('constraint') || insertErr.message.includes('violates')) {
      console.log(`  Insert with "queue" failed (${insertErr.message}). Falling back to "todo" for Ajack...`)
      const fallbackProjects = FRESH_PROJECTS.map(p =>
        p.id === 'ajack' ? { ...p, status: 'todo' } : p
      )
      const { data: retryData, error: retryErr } = await sb
        .from('projects')
        .insert(fallbackProjects)
        .select()
      if (retryErr) {
        console.error('  Retry also failed:', retryErr.message)
        process.exit(1)
      }
      console.log('  Inserted (Ajack as "todo" — apply migration 20260222000001 to allow "queue"):')
      retryData?.forEach(p => console.log(`    - ${p.title} [${p.status}]`))
    } else {
      console.error('  Failed to insert projects:', insertErr.message)
      process.exit(1)
    }
  } else {
    console.log('  Inserted:')
    inserted?.forEach(p => console.log(`    - ${p.title} [${p.status}]`))
  }

  // Step 6: Verify
  console.log('\n6. Verifying...')
  // Note: if Ajack shows as "todo", apply migration 20260222000001_project_queue_status.sql
  // to add "queue" to the project status constraint, then update Ajack's status.
  const { data: projects, error: verifyErr } = await sb
    .from('projects')
    .select('id, title, status')
    .order('priority')

  if (verifyErr) {
    console.error('  Verify failed:', verifyErr.message)
    process.exit(1)
  }

  console.log(`  ${projects?.length} projects in DB:`)
  projects?.forEach(p => console.log(`    [${p.status}] ${p.title} (${p.id})`))

  const { count: missionCount } = await sb
    .from('missions')
    .select('id', { count: 'exact', head: true })

  console.log(`  ${missionCount ?? 0} missions remaining.`)

  console.log('\n=== Reset complete ===')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
