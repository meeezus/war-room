import { NextRequest } from 'next/server'
import { createMission } from '@/lib/queries'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, project_id, assigned_to, status, councilSessionId } = body as Record<string, unknown>

  if (!title || typeof title !== 'string') {
    return Response.json({ error: 'title is required' }, { status: 400 })
  }
  if (!project_id || typeof project_id !== 'string') {
    return Response.json({ error: 'project_id is required' }, { status: 400 })
  }

  const mission = await createMission({
    title,
    project_id,
    assigned_to: typeof assigned_to === 'string' ? assigned_to : undefined,
    status: typeof status === 'string' ? status : undefined,
    councilSessionId: typeof councilSessionId === 'string' ? councilSessionId : undefined,
  })

  if (!mission) {
    return Response.json({ error: 'Failed to create mission' }, { status: 500 })
  }
  return Response.json({ mission }, { status: 201 })
}
