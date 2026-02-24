import { createServiceClient } from '@/lib/supabase-server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PulseAction =
  | { type: 'create_mission'; title: string; project_id?: string; assigned_to?: string }
  | { type: 'create_proposal'; title: string; description?: string; domain?: string }
  | { type: 'update_task'; task_id: number; status: string }
  | { type: 'update_project'; project_id: string; status?: string; priority?: number }
  | { type: 'flag_attention'; message: string }

export type ActionResult = {
  action: PulseAction
  success: boolean
  message: string
  id?: string | number
}

const KNOWN_TYPES = new Set([
  'create_mission',
  'create_proposal',
  'update_task',
  'update_project',
  'flag_attention',
])

// ---------------------------------------------------------------------------
// parseActions — extract [ACTION]...[/ACTION] blocks from response text
// ---------------------------------------------------------------------------

const ACTION_BLOCK_RE = /\[ACTION\]([\s\S]*?)\[\/ACTION\]/g

export function parseActions(response: string): PulseAction[] {
  const actions: PulseAction[] = []

  for (const match of response.matchAll(ACTION_BLOCK_RE)) {
    const raw = match[1].trim()
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && KNOWN_TYPES.has(parsed.type)) {
        actions.push(parsed as PulseAction)
      } else {
        console.warn('[pulse-actions] Skipping action with unknown type:', parsed?.type)
      }
    } catch (err) {
      console.warn('[pulse-actions] Malformed JSON in ACTION block:', raw, err)
    }
  }

  return actions
}

// ---------------------------------------------------------------------------
// stripActionBlocks — remove all [ACTION]...[/ACTION] blocks from text
// ---------------------------------------------------------------------------

export function stripActionBlocks(response: string): string {
  return response
    .replace(ACTION_BLOCK_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ---------------------------------------------------------------------------
// executeActions — run parsed actions against Supabase
// ---------------------------------------------------------------------------

export async function executeActions(actions: PulseAction[]): Promise<ActionResult[]> {
  const sb = createServiceClient()

  if (!sb) {
    return actions.map((action) => ({
      action,
      success: false,
      message: 'No Supabase connection (missing credentials)',
    }))
  }

  const results: ActionResult[] = []

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create_mission': {
          const { data, error } = await sb
            .from('missions')
            .insert({
              title: action.title,
              project_id: action.project_id ?? null,
              assigned_to: action.assigned_to ?? 'makima',
              status: 'queued',
              priority: 5,
            })
            .select('id')
            .single()

          if (error) throw error
          results.push({
            action,
            success: true,
            message: `Mission "${action.title}" created`,
            id: data.id,
          })
          break
        }

        case 'create_proposal': {
          const { data, error } = await sb
            .from('proposals')
            .insert({
              title: action.title,
              description: action.description ?? null,
              domain: action.domain ?? 'coordination',
              source: 'manual',
              requested_by: 'makima',
              status: 'pending',
            })
            .select('id')
            .single()

          if (error) throw error
          results.push({
            action,
            success: true,
            message: `Proposal "${action.title}" created`,
            id: data.id,
          })
          break
        }

        case 'update_task': {
          const { error } = await sb
            .from('tasks')
            .update({
              status: action.status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', action.task_id)

          if (error) throw error
          results.push({
            action,
            success: true,
            message: `Task ${action.task_id} updated to "${action.status}"`,
            id: action.task_id,
          })
          break
        }

        case 'update_project': {
          const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          }
          if (action.status !== undefined) updates.status = action.status
          if (action.priority !== undefined) updates.priority = action.priority

          const { error } = await sb
            .from('projects')
            .update(updates)
            .eq('id', action.project_id)

          if (error) throw error
          results.push({
            action,
            success: true,
            message: `Project ${action.project_id} updated`,
            id: action.project_id,
          })
          break
        }

        case 'flag_attention': {
          const { data, error } = await sb
            .from('events')
            .insert({
              type: 'user_request',
              agent: 'makima',
              message: action.message,
              metadata: { source: 'pulse_action' },
            })
            .select('id')
            .single()

          if (error) throw error
          results.push({
            action,
            success: true,
            message: `Attention flagged: "${action.message}"`,
            id: data.id,
          })
          break
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({
        action,
        success: false,
        message: `Failed: ${msg}`,
      })
    }
  }

  return results
}
