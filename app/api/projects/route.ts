import { NextRequest } from 'next/server'
import { createProject, getProjects } from '@/lib/queries'

export async function GET() {
  const projects = await getProjects()
  return Response.json({ projects })
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, description, status, councilSessionId } = body as Record<string, unknown>

  if (!title || typeof title !== 'string') {
    return Response.json({ error: 'title is required' }, { status: 400 })
  }

  const project = await createProject({
    title,
    description: typeof description === 'string' ? description : undefined,
    status: typeof status === 'string' ? status : undefined,
    councilSessionId: typeof councilSessionId === 'string' ? councilSessionId : undefined,
  })

  if (!project) {
    return Response.json({ error: 'Failed to create project' }, { status: 500 })
  }
  return Response.json({ project }, { status: 201 })
}
