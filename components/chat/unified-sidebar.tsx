"use client"

import { useState } from 'react'
import { ChevronDown, ChevronRight, Hash, Plus, MessageSquare, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ThreadSummary } from './thread-list'
import type { Category, Channel } from './channel-sidebar'

export interface UnifiedSidebarProps {
  // DM props
  threads: ThreadSummary[]
  activeThreadId: string | null
  onSelectThread: (id: string) => void
  onNewThread: () => void
  isCreating?: boolean
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
  onRename?: (id: string, title: string) => void
  showArchived?: boolean
  onToggleArchived?: () => void

  // Channel props
  categories: Category[]
  channels: Channel[]
  activeChannelId: string | null
  onSelectChannel: (id: string) => void
  onCreateChannel?: (categoryId: string | null) => void
  onCreateCategory?: () => void
  onToggleCategory?: (id: string) => void
}

export function UnifiedSidebar({
  // DM props
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDelete,
  // Channel props
  categories,
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onCreateCategory,
  onToggleCategory,
}: UnifiedSidebarProps) {
  const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null)

  const channelsByCategory = (categoryId: string) =>
    channels.filter((ch) => ch.category_id === categoryId)

  const uncategorizedChannels = channels.filter((ch) => ch.category_id === null)

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium">
          Shoin Chat
        </h2>
        {onCreateCategory && (
          <button
            onClick={onCreateCategory}
            className="h-7 w-7 rounded-md bg-muted hover:bg-muted flex items-center justify-center transition-colors"
            title="Add category"
          >
            <Plus className="h-3.5 w-3.5 text-foreground/80" />
          </button>
        )}
      </div>

      {/* Single scrollable list */}
      <div className="flex-1 overflow-y-auto">
        {/* DMs Section */}
        <div className="py-2">
          <div className="flex items-center justify-between px-4 py-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Direct Messages
            </span>
            <button
              onClick={onNewThread}
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted transition-colors"
              title="New DM"
            >
              <Plus className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
          {threads.map((thread) => (
            <div
              key={thread.id}
              className="relative group"
              onMouseEnter={() => setHoveredThreadId(thread.id)}
              onMouseLeave={() => setHoveredThreadId(null)}
            >
              <button
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  'w-full text-left px-4 py-2 flex items-center gap-2 transition-colors',
                  activeThreadId === thread.id
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-foreground/70 hover:bg-muted/50'
                )}
              >
                {thread.agent_id && thread.agent_id !== 'cc' ? (
                  <img
                    src={`/avatars/${thread.agent_id}.webp`}
                    alt={thread.agent_id}
                    className="h-5 w-5 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-sm truncate pr-6">
                  {thread.agent_id === 'cc' ? 'Claude Code'
                    : thread.agent_id === 'makima' ? 'Makima'
                    : thread.agent_id ? thread.agent_id.charAt(0).toUpperCase() + thread.agent_id.slice(1)
                    : thread.title}
                </span>
              </button>
              {hoveredThreadId === thread.id && onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(thread.id)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded flex items-center justify-center bg-muted hover:bg-red-900/60 transition-colors"
                  title="Delete thread"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Categories + Channels Section */}
        {categories.map((category) => (
          <div key={category.id} className="py-1">
            {/* Category header */}
            <div className="flex items-center gap-1 px-3 py-1.5 w-full hover:bg-muted/30 transition-colors group">
              <button
                onClick={() => onToggleCategory?.(category.id)}
                className="flex items-center gap-1 flex-1 min-w-0"
              >
                {category.collapsed ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase truncate">
                  {category.name.toUpperCase()}
                </span>
              </button>
              {onCreateChannel && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('[sidebar] Plus button clicked for category:', category.id)
                    onCreateChannel(category.id)
                  }}
                  className="relative z-10 h-5 w-5 min-w-[20px] rounded flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0"
                  aria-label={`Add channel to ${category.name}`}
                >
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Channels in this category */}
            {!category.collapsed &&
              channelsByCategory(category.id).map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel.id)}
                  aria-label={channel.name}
                  className={cn(
                    'w-full text-left px-6 py-1.5 flex items-center gap-2 transition-colors text-sm',
                    activeChannelId === channel.id
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </button>
              ))}
          </div>
        ))}

        {/* Uncategorized channels */}
        {uncategorizedChannels.length > 0 && (
          <div className="py-1">
            {uncategorizedChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => onSelectChannel(channel.id)}
                aria-label={channel.name}
                className={cn(
                  'w-full text-left px-6 py-1.5 flex items-center gap-2 transition-colors text-sm',
                  activeChannelId === channel.id
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{channel.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
