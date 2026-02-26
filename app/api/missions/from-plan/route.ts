import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { captureError } from '@/lib/sentry'

/**
 * POST /api/missions/from-plan
 * Creates a mission and tasks from a Claude Code plan.
 *
 * Body: {
 *   title: string,
 *   description: string,
 *   projectId?: string,  // defaults to "dynasty"
 *   tasks: Array<{ subject: string, description: string }>,
 *   source: "claude-code"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, projectId = 'dynasty', tasks = [], source } = body as {
      title: string
      description: string
      projectId?: string
      tasks?: Array<{ subject: string; description: string }>
      source?: string
    }

    if (!title) {
      return Response.json({ error: 'title is required' }, { status: 400 })
    }

    const sb = createServiceClient()
    if (!sb) {
      return Response.json({ error: 'Service unavailable' }, { status: 503 })
    }

    // Create the mission
    const { data: mission, error: missionError } = await sb
      .from('missions')
      .insert({
        title,
        project_id: projectId,
        assigned_to: 'cc', // Claude Code
        status: 'queued',
        priority: 2,
        result: { description, source: source ?? 'claude-code' },
      })
      .select()
      .single()

    if (missionError) {
      captureError(missionError, 'from-plan.missionInsert')
      return Response.json({ error: missionError.message }, { status: 500 })
    }

    // Create tasks for the mission
    const taskIds: number[] = []
    if (tasks.length > 0) {
      const taskInserts = tasks.map((t, idx) => ({
        mission_id: mission.id,
        project_id: projectId,
        title: t.subject,
        description: t.description,
        status: 'todo',
        priority: idx + 1,
        kind: 'code' as const,
        owner: 'cc',
      }))

      const { data: insertedTasks, error: tasksError } = await sb
        .from('tasks')
        .insert(taskInserts)
        .select('id')

      if (tasksError) {
        captureError(tasksError, 'from-plan.tasksInsert', { missionId: mission.id, projectId })
        // Mission was created, tasks failed - partial success
      } else if (insertedTasks) {
        taskIds.push(...insertedTasks.map(t => t.id))
      }
    }

    // Create event for the mission creation
    await sb.from('war_room_events').insert({
      event_type: 'mission_started',
      agent_id: 'cc',
      title: `Mission created from plan: ${title}`,
      metadata: { source: source ?? 'claude-code', taskCount: tasks.length, mission_id: mission.id },
    })

    return Response.json({
      missionId: mission.id,
      taskIds,
    })
  } catch (err) {
    captureError(err, 'from-plan')
    return Response.json({ error: 'Failed to create mission from plan' }, { status: 500 })
  }
}
