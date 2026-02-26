import { NextRequest } from 'next/server'
import { deleteThread, archiveThread } from '@/lib/chat'
import { createServiceClient } from '@/lib/supabase-server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status, title, unread } = body as { status?: 'active' | 'archived'; title?: string; unread?: boolean }

    if (status === 'archived') {
      await archiveThread(id)
      return Response.json({ success: true })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status) updates.status = status
    if (title) updates.title = title
    if (typeof unread === 'boolean') updates.unread = unread

    const sb = createServiceClient()
    if (!sb) return Response.json({ error: 'Service unavailable' }, { status: 503 })

    const { data, error } = await sb
      .from('chat_threads')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return Response.json({ thread: data })
  } catch (err) {
    console.error('[threads/[id]/route] PATCH Error:', err)
    return Response.json({ error: 'Failed to update thread' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteThread(id)
    return Response.json({ success: true })
  } catch (err) {
    console.error('[threads/[id]/route] DELETE Error:', err)
    return Response.json({ error: 'Failed to delete thread' }, { status: 500 })
  }
}
