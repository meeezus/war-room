import { createServiceClient } from '@/lib/supabase-server'
import { sendPushBroadcast } from '@/lib/push-notifications-server'
import { emitDecision } from '@/lib/spark-bridge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PulseAction =
  | { type: 'create_mission'; title: string; project_id?: string; assigned_to?: string }
  | { type: 'create_proposal'; title: string; description?: string; domain?: string }
  | { type: 'update_task'; task_id: number; status: string }
  | { type: 'update_project'; project_id: string; status?: string; priority?: number }
  | { type: 'flag_attention'; message: string }
  | { type: 'approve_discovery'; discovery_id: string }
  | { type: 'dismiss_discovery'; discovery_id: string; reason?: string }

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
  'approve_discovery',
  'dismiss_discovery',
])

// ---------------------------------------------------------------------------
// parseActions — extract [ACTION]...[/ACTION] blocks from response text
// ---------------------------------------------------------------------------

const actionBlockRe = () => /\[ACTION\]([\s\S]*?)\[\/ACTION\]/g

export function parseActions(response: string): PulseAction[] {
  const actions: PulseAction[] = []

  for (const match of response.matchAll(actionBlockRe())) {
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
    .replace(actionBlockRe(), '')
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
            .from('war_room_events')
            .insert({
              event_type: 'user_request',
              agent_id: 'makima',
              title: action.message,
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

        case 'approve_discovery': {
          const { data: discovery, error: fetchErr } = await sb
            .from('discoveries')
            .select('id, title, status')
            .eq('id', action.discovery_id)
            .single()

          if (fetchErr) throw fetchErr

          if (discovery.status === 'approved' || discovery.status === 'executed') {
            results.push({ action, success: false, message: 'Discovery already processed' })
            break
          }

          const { data: proposal, error: propErr } = await sb
            .from('proposals')
            .insert({
              title: discovery.title,
              description: `Patrol discovery: ${discovery.title}`,
              source: 'patrol',
              requested_by: 'makima',
              status: 'pending',
            })
            .select('id')
            .single()

          if (propErr) throw propErr

          const { error: updateErr } = await sb
            .from('discoveries')
            .update({ status: 'approved', proposal_id: proposal.id })
            .eq('id', action.discovery_id)

          if (updateErr) throw updateErr

          await sb.from('war_room_events').insert({
            event_type: 'discovery_approved',
            agent_id: 'makima',
            title: `Discovery approved: "${discovery.title}"`,
            metadata: { discovery_id: action.discovery_id, title: discovery.title, proposal_id: proposal.id },
          })

          results.push({
            action,
            success: true,
            message: `Discovery "${discovery.title}" approved, proposal created`,
            id: proposal.id,
          })
          break
        }

        case 'dismiss_discovery': {
          const { data: discovery, error: fetchErr } = await sb
            .from('discoveries')
            .select('id, title')
            .eq('id', action.discovery_id)
            .single()

          if (fetchErr) throw fetchErr

          const { error: updateErr } = await sb
            .from('discoveries')
            .update({ status: 'dismissed', feedback: action.reason ?? null })
            .eq('id', action.discovery_id)

          if (updateErr) throw updateErr

          await sb.from('war_room_events').insert({
            event_type: 'discovery_dismissed',
            agent_id: 'makima',
            title: `Discovery dismissed: "${discovery.title}"`,
            metadata: { discovery_id: action.discovery_id, title: discovery.title, reason: action.reason },
          })

          results.push({
            action,
            success: true,
            message: `Discovery "${discovery.title}" dismissed`,
            id: action.discovery_id,
          })
          break
        }
      }

      // For important action types, send push notification and emit to Spark
      const lastResult = results[results.length - 1]
      if (
        lastResult?.success &&
        (action.type === 'create_mission' || action.type === 'create_proposal')
      ) {
        sendPushBroadcast({
          title: action.type === 'create_mission' ? 'New Mission' : 'New Proposal',
          body: action.title,
          url: '/chat',
        }).catch((err) =>
          console.error('[pulse-actions] Push failed:', err)
        )

        emitDecision(
          action.type,
          {
            id: lastResult.id,
            title: action.title,
            ...(action.type === 'create_proposal' && 'description' in action && {
              description: action.description,
            }),
          },
          'Makima pulse action'
        ).catch((err) =>
          console.error('[pulse-actions] Spark emit failed:', err)
        )
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
