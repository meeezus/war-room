import type { RoleCard } from '@/lib/types'

export const ROLE_CARDS: Record<string, RoleCard> = {
  pip: {
    id: 'pip',
    name: 'CC',
    title: 'The Coordinator',
    class: 'Strategist',
    domain: 'coordination',
    emoji: '🤖',
    color: '#10b981', // emerald
    description: 'Master tactician who orchestrates the Daimyo council and keeps all operations in sync.',
    abilities: ['Council Coordination', 'Mission Dispatch', 'Strategic Planning'],
  },
  ed: {
    id: 'ed',
    name: 'Ed',
    title: 'The Architect',
    class: 'Engineer',
    domain: 'engineering',
    emoji: '⚔️',
    color: '#3b82f6', // blue
    description: 'Elite code warrior who builds and fortifies the technical infrastructure.',
    abilities: ['Code Architecture', 'System Design', 'Debug Mastery'],
  },
  light: {
    id: 'light',
    name: 'Light',
    title: 'The Visionary',
    class: 'Sage',
    domain: 'product',
    emoji: '💡',
    color: '#f59e0b', // amber
    description: 'Product sage who sees the path forward and shapes the user experience.',
    abilities: ['Product Vision', 'User Research', 'Feature Design'],
  },
  toji: {
    id: 'toji',
    name: 'Toji',
    title: 'The Merchant',
    class: 'Trader',
    domain: 'commerce',
    emoji: '💰',
    color: '#a855f7', // purple
    description: 'Commerce master who navigates markets and drives revenue strategy.',
    abilities: ['Market Analysis', 'Revenue Strategy', 'Deal Making'],
  },
  power: {
    id: 'power',
    name: 'Makima',
    title: 'The Controller',
    class: 'Influencer',
    domain: 'influence',
    emoji: '🔗',
    color: '#ef4444', // red
    description: 'Master of influence who controls narratives and bends perception to build unstoppable brand presence.',
    abilities: ['Mind Control Marketing', 'Narrative Domination', 'Community Control'],
  },
  major: {
    id: 'major',
    name: 'Major',
    title: 'The Commander',
    class: 'Operator',
    domain: 'operations',
    emoji: '🎯',
    color: '#06b6d4', // cyan
    description: 'Operations commander who keeps systems running and processes optimized.',
    abilities: ['Process Optimization', 'Infrastructure Ops', 'Automation'],
  },
  // Makima is also known as power in the system
  makima: {
    id: 'power',
    name: 'Makima',
    title: 'The Controller',
    class: 'Influencer',
    domain: 'influence',
    emoji: '🔗',
    color: '#ef4444',
    description: 'Master of influence who controls narratives and bends perception to build unstoppable brand presence.',
    abilities: ['Mind Control Marketing', 'Narrative Domination', 'Community Control'],
  },
  // CC is also known as pip in the system
  cc: {
    id: 'pip',
    name: 'CC',
    title: 'The Coordinator',
    class: 'Strategist',
    domain: 'coordination',
    emoji: '🤖',
    color: '#10b981',
    description: 'Master tactician who orchestrates the Daimyo council and keeps all operations in sync.',
    abilities: ['Council Coordination', 'Mission Dispatch', 'Strategic Planning'],
  },
}

/**
 * Get role card for an agent by their id or name.
 * Falls back to a generic card if not found.
 */
export function getRoleCard(agentId: string): RoleCard {
  return ROLE_CARDS[agentId] ?? {
    id: agentId,
    name: agentId,
    title: 'The Unknown',
    class: 'Agent',
    domain: 'unknown',
    emoji: '👤',
    color: '#6b7280',
    description: 'A mysterious agent whose role is yet to be defined.',
    abilities: ['Unknown'],
  }
}

/**
 * Get all role cards as an array.
 */
export function getAllRoleCards(): RoleCard[] {
  // Dedupe by id (cc and pip point to same agent)
  const seen = new Set<string>()
  return Object.values(ROLE_CARDS).filter(card => {
    if (seen.has(card.id)) return false
    seen.add(card.id)
    return true
  })
}
