"use client"

import { Plus, MessageSquare } from 'lucide-react'

export interface ThreadSummary {
  id: string
  title: string
  last_message: string | null
  last_message_at: string
  agent_id: string | null
}

interface ThreadListProps {
  threads: ThreadSummary[]
  activeThreadId: string | null
  onSelectThread: (id: string) => void
  onNewThread: () => void
  isCreating?: boolean
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function ThreadList({ threads, activeThreadId, onSelectThread, onNewThread, isCreating }: ThreadListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-zinc-200">
          Threads
        </h2>
        <button
          onClick={onNewThread}
          disabled={isCreating}
          className="h-7 w-7 rounded-md bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5 text-zinc-300" />
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-zinc-500 text-xs">No threads yet</p>
          </div>
        )}
        {threads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 transition-colors ${
              activeThreadId === thread.id
                ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500'
                : 'hover:bg-zinc-900/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-200 truncate font-medium">
                    {thread.title}
                  </span>
                  <span className="text-[10px] text-zinc-600 flex-shrink-0 font-[family-name:var(--font-jetbrains-mono)]">
                    {timeAgo(thread.last_message_at)}
                  </span>
                </div>
                {thread.last_message && (
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {thread.last_message}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
