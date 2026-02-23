import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Types matching the migration schema
export interface ChatThread {
  id: string
  title: string
  agent_id: string | null
  user_id: string
  last_message: string | null
  last_message_at: string
  unread: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  thread_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agent_id: string | null
  user_id: string | null
  streaming: boolean
  streaming_complete: boolean
  metadata: Record<string, unknown>
  created_at: string
}

// Server-side client (uses service role key)
function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getThreads(): Promise<ChatThread[]> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_threads')
    .select('*')
    .order('last_message_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getThread(id: string): Promise<ChatThread | null> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_threads')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function createThread(
  title: string,
  agentId?: string
): Promise<ChatThread> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_threads')
    .insert({
      title: title || 'New Thread',
      agent_id: agentId || null,
      user_id: 'sensei',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMessages(threadId: string): Promise<ChatMessage[]> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveMessage(
  threadId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  agentId?: string
): Promise<ChatMessage> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_messages')
    .insert({
      thread_id: threadId,
      role,
      content,
      agent_id: agentId || null,
      user_id: role === 'user' ? 'sensei' : null,
    })
    .select()
    .single()
  if (error) throw error

  // Update thread's last message
  await sb
    .from('chat_threads')
    .update({
      last_message: content.slice(0, 200),
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)

  return data
}

export async function getThreadSessionId(threadId: string): Promise<string | null> {
  const sb = getServiceClient()
  const { data } = await sb
    .from('chat_threads')
    .select('metadata')
    .eq('id', threadId)
    .single()
  return (data?.metadata as Record<string, string>)?.sessionId ?? null
}

export async function setThreadSessionId(threadId: string, sessionId: string): Promise<void> {
  const sb = getServiceClient()
  const { data } = await sb
    .from('chat_threads')
    .select('metadata')
    .eq('id', threadId)
    .single()

  const metadata = { ...(data?.metadata as Record<string, unknown> ?? {}), sessionId }
  await sb
    .from('chat_threads')
    .update({ metadata })
    .eq('id', threadId)
}
