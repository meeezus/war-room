"use client"

import { useState } from 'react'
import { ThreadList, ThreadSummary } from './thread-list'
import { ChannelSidebar, Category, Channel } from './channel-sidebar'

type ViewMode = 'dms' | 'channels'

export interface UnifiedSidebarProps {
  // DM props (pass through to ThreadList)
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

  // Channel props (pass through to ChannelSidebar)
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
  isCreating,
  onArchive,
  onDelete,
  onRename,
  showArchived,
  onToggleArchived,
  // Channel props
  categories,
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onCreateCategory,
  onToggleCategory,
}: UnifiedSidebarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('dms')

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setViewMode('dms')}
          className={`flex-1 py-3 text-xs font-medium transition-colors ${
            viewMode === 'dms'
              ? 'text-emerald-400 border-b-2 border-emerald-500'
              : 'text-muted-foreground hover:text-foreground/80'
          }`}
        >
          Direct Messages
        </button>
        <button
          onClick={() => setViewMode('channels')}
          className={`flex-1 py-3 text-xs font-medium transition-colors ${
            viewMode === 'channels'
              ? 'text-emerald-400 border-b-2 border-emerald-500'
              : 'text-muted-foreground hover:text-foreground/80'
          }`}
        >
          Channels
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'dms' ? (
          <ThreadList
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={onSelectThread}
            onNewThread={onNewThread}
            isCreating={isCreating}
            onArchive={onArchive}
            onDelete={onDelete}
            onRename={onRename}
            showArchived={showArchived}
            onToggleArchived={onToggleArchived}
          />
        ) : (
          <ChannelSidebar
            categories={categories}
            channels={channels}
            activeChannelId={activeChannelId}
            onSelectChannel={onSelectChannel}
            onCreateChannel={onCreateChannel}
            onCreateCategory={onCreateCategory}
            onToggleCategory={onToggleCategory}
          />
        )}
      </div>
    </div>
  )
}
