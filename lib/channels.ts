import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types matching the chat_channels migration schema
// ---------------------------------------------------------------------------

export interface ChatCategory {
  id: string
  name: string
  position: number
  collapsed: boolean
  created_at: string
}

export interface ChatChannel {
  id: string
  category_id: string | null
  name: string
  description: string | null
  is_default: boolean
  created_by: string | null
  position: number
  created_at: string
}

export interface ChannelMessage {
  id: string
  channel_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agent_id: string | null
  reply_to_id: string | null
  thread_id: string | null
  thread_count: number
  forwarded_from: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Service client (mirrors chat.ts pattern)
// ---------------------------------------------------------------------------

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<ChatCategory[]> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_categories')
    .select('*')
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCategory(name: string): Promise<ChatCategory> {
  const sb = getServiceClient()

  // Determine next position
  const { data: existing } = await sb
    .from('chat_categories')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

  const { data, error } = await sb
    .from('chat_categories')
    .insert({ name, position: nextPosition })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(
  id: string,
  updates: Partial<Pick<ChatCategory, 'name' | 'collapsed' | 'position'>>
): Promise<ChatCategory> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const sb = getServiceClient()
  const { error } = await sb
    .from('chat_categories')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export async function getChannels(): Promise<ChatChannel[]> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_channels')
    .select('*')
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getChannel(id: string): Promise<ChatChannel | null> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_channels')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function createChannel(
  name: string,
  categoryId: string | null,
  createdBy: string,
  description?: string
): Promise<ChatChannel> {
  const sb = getServiceClient()

  // Determine next position
  const { data: existing } = await sb
    .from('chat_channels')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

  const { data, error } = await sb
    .from('chat_channels')
    .insert({
      name,
      category_id: categoryId,
      created_by: createdBy,
      description: description ?? null,
      position: nextPosition,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteChannel(id: string): Promise<void> {
  const sb = getServiceClient()
  // Messages cascade-delete via FK, so just delete the channel
  const { error } = await sb
    .from('chat_channels')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function getChannelMessages(
  channelId: string,
  limit = 50
): Promise<ChannelMessage[]> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_channel_messages')
    .select('*')
    .eq('channel_id', channelId)
    .is('thread_id', null)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getThreadMessages(
  threadId: string
): Promise<ChannelMessage[]> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_channel_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveChannelMessage(
  channelId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  options?: {
    agentId?: string
    replyToId?: string
    threadId?: string
    forwardedFrom?: string
  }
): Promise<ChannelMessage> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_channel_messages')
    .insert({
      channel_id: channelId,
      role,
      content,
      agent_id: options?.agentId ?? null,
      reply_to_id: options?.replyToId ?? null,
      thread_id: options?.threadId ?? null,
      forwarded_from: options?.forwardedFrom ?? null,
    })
    .select()
    .single()
  if (error) throw error

  // Increment thread_count on the parent message when this is a thread reply
  if (options?.threadId) {
    await sb.rpc('increment_thread_count', { message_id: options.threadId })
  }

  return data
}

export async function forwardMessage(
  messageId: string,
  targetChannelId: string
): Promise<ChannelMessage> {
  const sb = getServiceClient()

  // Fetch the original message
  const { data: original, error: fetchError } = await sb
    .from('chat_channel_messages')
    .select('*')
    .eq('id', messageId)
    .single()
  if (fetchError) throw fetchError
  if (!original) throw new Error('Message not found')

  // Insert a copy in the target channel with forwarded_from set
  const { data, error } = await sb
    .from('chat_channel_messages')
    .insert({
      channel_id: targetChannelId,
      role: original.role,
      content: original.content,
      agent_id: original.agent_id,
      forwarded_from: messageId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
