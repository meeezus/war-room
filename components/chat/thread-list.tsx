"use client"

import { useState, useRef, useEffect } from 'react'
import { Plus, MessageSquare, Archive, Trash2 } from 'lucide-react'

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
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
  onRename?: (id: string, title: string) => void
  showArchived?: boolean
  onToggleArchived?: () => void
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

export function ThreadList({
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
}: ThreadListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleStartEdit = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation()
    e.preventDefault()
    setEditingId(id)
    setEditTitle(currentTitle)
  }

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim() && onRename) {
      onRename(editingId, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle('')
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditTitle('')
    }
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (window.confirm('Delete this thread?')) {
      onDelete?.(id)
    }
  }

  const handleArchive = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    onArchive?.(id)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-foreground">
          Threads
        </h2>
        <button
          onClick={onNewThread}
          disabled={isCreating}
          className="h-7 w-7 rounded-md bg-muted hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5 text-foreground/80" />
        </button>
      </div>

      {/* Active / Archived toggle */}
      {onToggleArchived && (
        <div className="flex border-b border-border">
          <button
            onClick={() => showArchived && onToggleArchived()}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              !showArchived
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => !showArchived && onToggleArchived()}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              showArchived
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            Archived
          </button>
        </div>
      )}

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-muted-foreground text-xs">No threads yet</p>
          </div>
        )}
        {threads.map((thread) => (
          <div
            key={thread.id}
            className="relative"
            onMouseEnter={() => setHoveredId(thread.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <button
              onClick={() => onSelectThread(thread.id)}
              className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors ${
                activeThreadId === thread.id
                  ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500'
                  : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-start gap-2">
                {thread.agent_id && thread.agent_id !== 'cc' ? (
                  <img
                    src={`/avatars/${thread.agent_id}.webp`}
                    alt={thread.agent_id}
                    className="h-5 w-5 rounded-full object-cover mt-0.5 flex-shrink-0"
                  />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    {editingId === thread.id ? (
                      <input
                        ref={editInputRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={handleEditKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-foreground font-medium bg-muted border border-border rounded px-1 py-0 w-full outline-none focus:border-emerald-500"
                      />
                    ) : (
                      <span
                        className="text-sm text-foreground truncate font-medium"
                        onDoubleClick={(e) => handleStartEdit(e, thread.id, thread.title)}
                      >
                        {thread.title}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 font-[family-name:var(--font-jetbrains-mono)]">
                      {timeAgo(thread.last_message_at)}
                    </span>
                  </div>
                  {thread.last_message && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {thread.last_message}
                    </p>
                  )}
                </div>
              </div>
            </button>

            {/* Hover actions */}
            {hoveredId === thread.id && (onArchive || onDelete) && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {onArchive && (
                  <button
                    onClick={(e) => handleArchive(e, thread.id)}
                    className="h-6 w-6 rounded flex items-center justify-center bg-muted hover:bg-muted transition-colors"
                    title="Archive thread"
                  >
                    <Archive className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => handleDelete(e, thread.id)}
                    className="h-6 w-6 rounded flex items-center justify-center bg-muted hover:bg-red-900/60 transition-colors"
                    title="Delete thread"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
