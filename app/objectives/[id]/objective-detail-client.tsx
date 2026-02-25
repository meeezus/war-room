'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X, Loader2, Plus, ChevronRight } from 'lucide-react'
import type { Objective, Project, Mission, Proposal } from '@/lib/types'
import { StealthCard } from '@/components/stealth-card'
import { Breadcrumb } from '@/components/breadcrumb'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<Objective['status'], string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  paused: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
  capped: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
}

const STATUS_OPTIONS: { value: Objective['status']; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'capped', label: 'Capped' },
]

const MISSION_STATUS_COLORS: Record<string, string> = {
  queued: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
  running: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  review: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  deployed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
  stale: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
}

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border border-red-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
}

const PROJECT_STATUS_COLORS: Record<string, string> = {
  inprogress: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  queue: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
  done: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  onhold: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
}

type Tab = 'projects' | 'missions' | 'proposals'

const inputClasses =
  'border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/20 transition-colors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ObjectiveDetailClientProps {
  objective: Objective
  projects: Project[]
  missions: Mission[]
  proposals: Proposal[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ObjectiveDetailClient({
  objective: initialObjective,
  projects,
  missions,
  proposals,
}: ObjectiveDetailClientProps) {
  const router = useRouter()

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('projects')

  // Editing state
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editTitle, setEditTitle] = useState(initialObjective.title)
  const [editStatus, setEditStatus] = useState<Objective['status']>(initialObjective.status)
  const [editDescription, setEditDescription] = useState(initialObjective.description ?? '')
  const [editCriteria, setEditCriteria] = useState(initialObjective.success_criteria)

  // Optimistic state
  const [optimistic, setOptimistic] = useState<{
    title?: string
    status?: Objective['status']
    description?: string | null
    success_criteria?: string
  } | null>(null)

  const displayTitle = optimistic?.title ?? initialObjective.title
  const displayStatus = optimistic?.status ?? initialObjective.status
  const displayDescription = optimistic?.description !== undefined ? optimistic.description : initialObjective.description
  const displayCriteria = optimistic?.success_criteria ?? initialObjective.success_criteria

  // Creating project state
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)

  // Progress: N of M projects done
  const totalProjects = projects.length
  const doneProjects = projects.filter((p) => p.status === 'done').length
  const projectPct = totalProjects > 0 ? Math.round((doneProjects / totalProjects) * 100) : 0

  // Iteration progress
  const iterPct = Math.min(100, Math.round((initialObjective.iteration_count / initialObjective.max_iterations) * 100))

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const startEditing = useCallback(() => {
    setEditTitle(optimistic?.title ?? initialObjective.title)
    setEditStatus(optimistic?.status ?? initialObjective.status)
    setEditDescription((optimistic?.description !== undefined ? optimistic.description : initialObjective.description) ?? '')
    setEditCriteria(optimistic?.success_criteria ?? initialObjective.success_criteria)
    setIsEditing(true)
  }, [initialObjective, optimistic])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
  }, [])

  const saveEdits = useCallback(async () => {
    const changes: Record<string, unknown> = {}
    const ct = optimistic?.title ?? initialObjective.title
    const cs = optimistic?.status ?? initialObjective.status
    const cd = optimistic?.description !== undefined ? optimistic.description : initialObjective.description
    const cc = optimistic?.success_criteria ?? initialObjective.success_criteria

    if (editTitle.trim() && editTitle.trim() !== ct) changes.title = editTitle.trim()
    if (editStatus !== cs) changes.status = editStatus
    const descVal = editDescription.trim() || null
    if (descVal !== (cd ?? null)) changes.description = descVal
    if (editCriteria.trim() && editCriteria.trim() !== cc) changes.success_criteria = editCriteria.trim()

    if (Object.keys(changes).length === 0) {
      setIsEditing(false)
      return
    }

    setOptimistic((prev) => ({ ...prev, ...changes } as typeof optimistic))
    setIsEditing(false)
    setIsSaving(true)

    try {
      const res = await fetch(`/api/objectives/${initialObjective.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      if (!res.ok) {
        console.error('Failed to save objective:', await res.text())
        setOptimistic(null)
      }
    } catch (err) {
      console.error('Save error:', err)
      setOptimistic(null)
    } finally {
      setIsSaving(false)
    }
  }, [initialObjective, optimistic, editTitle, editStatus, editDescription, editCriteria])

  const handleCreateProject = useCallback(async () => {
    if (!newProjectTitle.trim()) return
    setCreatingProject(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newProjectTitle.trim(),
          objective_id: initialObjective.id,
          status: 'queue',
        }),
      })
      if (res.ok) {
        setNewProjectTitle('')
        setIsCreatingProject(false)
        router.refresh()
      } else {
        console.error('Failed to create project:', await res.text())
      }
    } catch (err) {
      console.error('Create project error:', err)
    } finally {
      setCreatingProject(false)
    }
  }, [newProjectTitle, initialObjective.id, router])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <Breadcrumb
          segments={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Objectives', href: '/objectives' },
            { label: displayTitle },
          ]}
          className="mb-6"
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          {isEditing ? (
            <div className="flex-1 flex flex-col gap-3">
              <input
                className={`${inputClasses} w-full rounded-sm text-lg font-bold`}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Objective title"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <select
                  className={`${inputClasses} rounded-sm text-xs`}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as Objective['status'])}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={saveEdits}
                  className="inline-flex items-center gap-1 rounded-sm bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
                >
                  <Check className="h-3 w-3" /> Save
                </button>
                <button
                  onClick={cancelEditing}
                  className="inline-flex items-center gap-1 rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground leading-snug">
                  {displayTitle}
                </h1>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${STATUS_COLORS[displayStatus]}`}
                >
                  {displayStatus}
                </span>
                <button
                  onClick={startEditing}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Details card */}
        <StealthCard className="p-5 mb-6" hover={false}>
          {/* Description */}
          {isEditing ? (
            <textarea
              className={`${inputClasses} w-full rounded-sm mb-4 min-h-[60px]`}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
            />
          ) : displayDescription ? (
            <p className="text-sm text-muted-foreground mb-4">{displayDescription}</p>
          ) : null}

          {/* Success criteria */}
          <div className="mb-4">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-[family-name:var(--font-space-grotesk)]">
              Success Criteria
            </span>
            {isEditing ? (
              <textarea
                className={`${inputClasses} w-full rounded-sm mt-1 min-h-[40px]`}
                value={editCriteria}
                onChange={(e) => setEditCriteria(e.target.value)}
                placeholder="Success criteria"
              />
            ) : (
              <p className="text-sm text-foreground mt-1">{displayCriteria}</p>
            )}
          </div>

          {/* Progress bars */}
          <div className="space-y-3 mb-4">
            {/* Project completion progress */}
            {totalProjects > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-[family-name:var(--font-space-grotesk)]">
                    Project Progress
                  </span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground">
                    {doneProjects}/{totalProjects} complete ({projectPct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${projectPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Iteration progress */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-[family-name:var(--font-space-grotesk)]">
                  Iterations
                </span>
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted-foreground">
                  {initialObjective.iteration_count}/{initialObjective.max_iterations} ({iterPct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${iterPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground/75">
            <div>
              <span className="text-muted-foreground/50">Created by:</span> {initialObjective.created_by}
            </div>
            <div>
              <span className="text-muted-foreground/50">Created:</span> {formatDate(initialObjective.created_at)}
            </div>
            {initialObjective.max_cost_usd && (
              <div>
                <span className="text-muted-foreground/50">Budget:</span> ${initialObjective.max_cost_usd}
              </div>
            )}
            {initialObjective.project_id && (
              <div>
                <span className="text-muted-foreground/50">Project:</span>{' '}
                <Link href={`/projects/${initialObjective.project_id}`} className="text-blue-400 hover:text-blue-300">
                  {initialObjective.project_id.slice(0, 8)}...
                </Link>
              </div>
            )}
            {initialObjective.completed_at && (
              <div>
                <span className="text-muted-foreground/50">Completed:</span> {formatDate(initialObjective.completed_at)}
              </div>
            )}
          </div>
        </StealthCard>

        {/* Tabs */}
        <div className="border-b border-border mb-6">
          <nav className="flex gap-6">
            {(['projects', 'missions', 'proposals'] as Tab[]).map((tab) => {
              const count = tab === 'projects' ? projects.length : tab === 'missions' ? missions.length : proposals.length
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-emerald-500 text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground/70'
                  }`}
                >
                  <span className="font-[family-name:var(--font-space-grotesk)] uppercase tracking-wider text-xs">
                    {tab}
                  </span>
                  <span className="ml-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
                    ({count})
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'projects' && (
          <div>
            {/* Create project inline form */}
            <div className="mb-4">
              {isCreatingProject ? (
                <div className="flex items-center gap-2">
                  <input
                    className={`${inputClasses} flex-1 rounded-sm`}
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    placeholder="New project title..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateProject()
                      if (e.key === 'Escape') {
                        setIsCreatingProject(false)
                        setNewProjectTitle('')
                      }
                    }}
                  />
                  <button
                    onClick={handleCreateProject}
                    disabled={creatingProject || !newProjectTitle.trim()}
                    className="inline-flex items-center gap-1 rounded-sm bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                  >
                    {creatingProject ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Create
                  </button>
                  <button
                    onClick={() => { setIsCreatingProject(false); setNewProjectTitle('') }}
                    className="inline-flex items-center gap-1 rounded-sm border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreatingProject(true)}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Create Project
                </button>
              )}
            </div>

            {projects.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic">No projects linked to this objective</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="group block"
                  >
                    <StealthCard className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm text-foreground font-medium group-hover:text-emerald-400 transition-colors truncate">
                          {p.title}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                            PROJECT_STATUS_COLORS[p.status] ?? 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      {p.goal && (
                        <p className="text-xs text-muted-foreground/70 line-clamp-2 mb-2">{p.goal}</p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
                        <span>Priority: {p.priority}</span>
                        <span className="flex items-center gap-0.5">
                          {formatDateShort(p.updated_at)}
                          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                    </StealthCard>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'missions' && (
          <div>
            {missions.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic">No missions yet</p>
            ) : (
              <div className="flex flex-col gap-2">
                {missions.map((m) => (
                  <Link
                    key={m.id}
                    href="/missions"
                    className="block rounded-sm border border-border bg-card/50 p-3 transition-colors hover:bg-card/80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground font-medium truncate">{m.title}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          MISSION_STATUS_COLORS[m.status] ?? 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground/60">
                      {m.assigned_to && <span>{m.assigned_to}</span>}
                      <span>{formatDate(m.created_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'proposals' && (
          <div>
            {proposals.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic">No proposals yet</p>
            ) : (
              <div className="flex flex-col gap-2">
                {proposals.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-sm border border-border bg-card/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground font-medium truncate">{p.title}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          PROPOSAL_STATUS_COLORS[p.status] ?? 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground/60">
                      {p.source && <span>{p.source}</span>}
                      {p.domain && <span>{p.domain}</span>}
                      <span>{formatDate(p.created_at)}</span>
                    </div>
                    {p.description && (
                      <p className="text-xs text-muted-foreground/50 mt-2 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
