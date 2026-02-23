"use client"

import { useState, useEffect, useCallback } from 'react'

interface ChatActionsProps {
  messageContent: string
  threadId: string
}

type ActiveForm = 'proposal' | 'objective' | null

const DOMAINS = [
  'engineering',
  'product',
  'operations',
  'commerce',
  'influence',
  'coordination',
] as const

export function ChatActions({ messageContent, threadId }: ChatActionsProps) {
  const [activeForm, setActiveForm] = useState<ActiveForm>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Escape key closes the active form
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setActiveForm(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-clear success message after 3 seconds
  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(null), 3000)
    return () => clearTimeout(timer)
  }, [success])

  const toggleForm = useCallback((form: ActiveForm) => {
    setActiveForm(prev => (prev === form ? null : form))
    setError(null)
  }, [])

  const handleProposalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.get('title'),
          description: formData.get('description'),
          domain: formData.get('domain'),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create proposal')
      }

      const data = await res.json()
      setSuccess(`Proposal created (ID: ${data.proposal.id})`)
      setActiveForm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleObjectiveSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.get('title'),
          description: formData.get('description'),
          success_criteria: formData.get('success_criteria'),
          max_iterations: Number(formData.get('max_iterations')),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create objective')
      }

      const data = await res.json()
      setSuccess(`Objective created (ID: ${data.objective.id})`)
      setActiveForm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create objective')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClasses =
    'w-full bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-500'
  const labelClasses =
    'block text-xs text-zinc-400 mb-1 font-[family-name:var(--font-jetbrains-mono)]'

  return (
    <div className="flex flex-col gap-2 px-4 py-2 border-t border-zinc-800/50">
      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => toggleForm('proposal')}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
        >
          Create Proposal
        </button>
        <button
          type="button"
          onClick={() => toggleForm('objective')}
          className="text-xs px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
        >
          Create Objective
        </button>
      </div>

      {/* Proposal form */}
      {activeForm === 'proposal' && (
        <form onSubmit={handleProposalSubmit} className="flex flex-col gap-3 mt-2 p-3 rounded-md bg-zinc-900/50 border border-zinc-800">
          <div>
            <label htmlFor="proposal-title" className={labelClasses}>
              Title
            </label>
            <input
              id="proposal-title"
              name="title"
              type="text"
              defaultValue={messageContent.slice(0, 80)}
              className={inputClasses}
              required
            />
          </div>
          <div>
            <label htmlFor="proposal-description" className={labelClasses}>
              Description
            </label>
            <textarea
              id="proposal-description"
              name="description"
              defaultValue={messageContent}
              rows={3}
              className={inputClasses}
              required
            />
          </div>
          <div>
            <label htmlFor="proposal-domain" className={labelClasses}>
              Domain
            </label>
            <select
              id="proposal-domain"
              name="domain"
              className={inputClasses}
            >
              {DOMAINS.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="self-start text-xs px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Proposal'}
          </button>
        </form>
      )}

      {/* Objective form */}
      {activeForm === 'objective' && (
        <form onSubmit={handleObjectiveSubmit} className="flex flex-col gap-3 mt-2 p-3 rounded-md bg-zinc-900/50 border border-zinc-800">
          <div>
            <label htmlFor="objective-title" className={labelClasses}>
              Title
            </label>
            <input
              id="objective-title"
              name="title"
              type="text"
              className={inputClasses}
              required
            />
          </div>
          <div>
            <label htmlFor="objective-description" className={labelClasses}>
              Description
            </label>
            <textarea
              id="objective-description"
              name="description"
              defaultValue={messageContent}
              rows={3}
              className={inputClasses}
              required
            />
          </div>
          <div>
            <label htmlFor="objective-criteria" className={labelClasses}>
              Success Criteria
            </label>
            <textarea
              id="objective-criteria"
              name="success_criteria"
              rows={2}
              className={inputClasses}
              required
            />
          </div>
          <div>
            <label htmlFor="objective-iterations" className={labelClasses}>
              Max Iterations
            </label>
            <input
              id="objective-iterations"
              name="max_iterations"
              type="number"
              defaultValue={5}
              min={1}
              max={100}
              className={inputClasses}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="self-start text-xs px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Objective'}
          </button>
        </form>
      )}

      {/* Success message */}
      {success && (
        <p className="text-xs text-emerald-400">{success}</p>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
