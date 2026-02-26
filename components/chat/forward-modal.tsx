"use client"

import { useState } from 'react'
import { X, Search, Hash } from 'lucide-react'
import type { Channel } from './channel-sidebar'

interface ForwardModalProps {
  channels: Channel[]
  currentChannelId: string
  onForward: (targetChannelId: string) => void
  onClose: () => void
}

export function ForwardModal({
  channels,
  currentChannelId,
  onForward,
  onClose,
}: ForwardModalProps) {
  const [search, setSearch] = useState('')

  const filteredChannels = channels.filter(
    (ch) =>
      ch.id !== currentChannelId &&
      ch.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm bg-background border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium">
            Forward to channel
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels..."
              className="w-full bg-muted rounded-md pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoFocus
            />
          </div>
        </div>

        {/* Channel list */}
        <div className="max-h-60 overflow-y-auto p-2">
          {filteredChannels.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">No channels found</p>
          ) : (
            filteredChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => onForward(channel.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-left"
              >
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{channel.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
