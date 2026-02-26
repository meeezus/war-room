"use client"

import { useState } from 'react'
import { ChevronDown, ChevronRight, Hash, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Category {
  id: string
  name: string
  collapsed: boolean
}

export interface Channel {
  id: string
  category_id: string | null
  name: string
  is_default: boolean
}

interface ChannelSidebarProps {
  categories: Category[]
  channels: Channel[]
  activeChannelId: string | null
  onSelectChannel: (id: string) => void
  onCreateChannel?: (categoryId: string | null) => void
  onCreateCategory?: () => void
  onToggleCategory?: (id: string) => void
}

export function ChannelSidebar({
  categories,
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onCreateCategory,
  onToggleCategory,
}: ChannelSidebarProps) {
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null)

  const channelsByCategory = (categoryId: string) =>
    channels.filter((ch) => ch.category_id === categoryId)

  const uncategorizedChannels = channels.filter((ch) => ch.category_id === null)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-border"
        data-testid="sidebar-header"
      >
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-foreground">
          Channels
        </h2>
        {onCreateCategory && (
          <button
            onClick={onCreateCategory}
            className="h-7 w-7 rounded-md bg-muted hover:bg-muted flex items-center justify-center transition-colors"
            aria-label="Create category"
          >
            <Plus className="h-3.5 w-3.5 text-foreground/80" />
          </button>
        )}
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {/* Categories */}
        {categories.map((category) => (
          <div key={category.id}>
            {/* Category header */}
            <div
              className="group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
              onMouseEnter={() => setHoveredCategoryId(category.id)}
              onMouseLeave={() => setHoveredCategoryId(null)}
            >
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
              {hoveredCategoryId === category.id && onCreateChannel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateChannel(category.id)
                  }}
                  className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0"
                  aria-label={`Add channel to ${category.name}`}
                >
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Channels in this category */}
            {!category.collapsed &&
              channelsByCategory(category.id).map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={activeChannelId === channel.id}
                  onSelect={onSelectChannel}
                />
              ))}
          </div>
        ))}

        {/* Uncategorized channels */}
        {uncategorizedChannels.length > 0 && (
          <div>
            {uncategorizedChannels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={activeChannelId === channel.id}
                onSelect={onSelectChannel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ChannelItem({
  channel,
  isActive,
  onSelect,
}: {
  channel: Channel
  isActive: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      onClick={() => onSelect(channel.id)}
      aria-label={channel.name}
      className={cn(
        'w-full text-left px-4 py-1.5 flex items-center gap-2 transition-colors text-sm',
        isActive
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
    >
      <Hash className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">{channel.name}</span>
    </button>
  )
}
