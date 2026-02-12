"use client"

import { useEffect, useRef, useState } from 'react'
import type { AgentStatus, Mission } from '@/lib/types'
import { DojoAgent } from './dojo-agent'
import { DojoPlayer } from './dojo-player'
import { MissionBoard } from './mission-board'

interface DojoFloorProps {
  agents: AgentStatus[]
  missions: Mission[]
  onAgentInteract: (agent: AgentStatus) => void
  onAgentClick?: (agent: AgentStatus, position: { x: number; y: number }) => void
  agentRingColors?: Record<string, string>
  onBoardClick: () => void
  inputDisabled?: boolean
}

const AGENT_POSITIONS: Record<string, { x: number; y: number }> = {
  'pip': { x: 150, y: 120 },
  'cc': { x: 150, y: 120 },
  'ed': { x: 650, y: 120 },
  'light': { x: 400, y: 100 },
  'toji': { x: 120, y: 350 },
  'power': { x: 680, y: 350 },
  'makima': { x: 680, y: 350 },
  'major': { x: 400, y: 450 },
}

const MISSION_BOARD_POSITION = { x: 400, y: 30 }
const INTERACTION_RADIUS = 60
const MOVE_SPEED = 3
const ROOM_WIDTH = 800
const ROOM_HEIGHT = 600

export function DojoFloor({ agents, missions, onAgentInteract, onAgentClick, agentRingColors, onBoardClick, inputDisabled }: DojoFloorProps) {
  const [playerPos, setPlayerPos] = useState({ x: 400, y: 300 })
  const [targetPos, setTargetPos] = useState<{ x: number; y: number } | null>(null)
  const keysDown = useRef(new Set<string>())
  const floorRef = useRef<HTMLDivElement>(null)

  // Keyboard input
  useEffect(() => {
    if (inputDisabled) {
      keysDown.current.clear()
      return
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysDown.current.add(key)
        e.preventDefault()
      }
      // Interaction key
      if (key === 'a' && nearbyAgent) {
        onAgentInteract(nearbyAgent)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.key.toLowerCase())
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [onAgentInteract, inputDisabled])

  // Click-to-move
  const handleFloorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!floorRef.current) return
    const rect = floorRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setTargetPos({ x, y })
  }

  // Movement loop
  useEffect(() => {
    let animId: number

    const tick = () => {
      setPlayerPos((prev) => {
        let { x, y } = prev

        // Keyboard movement
        if (keysDown.current.size > 0) {
          if (keysDown.current.has('w') || keysDown.current.has('arrowup')) y -= MOVE_SPEED
          if (keysDown.current.has('s') || keysDown.current.has('arrowdown')) y += MOVE_SPEED
          if (keysDown.current.has('a') || keysDown.current.has('arrowleft')) x -= MOVE_SPEED
          if (keysDown.current.has('d') || keysDown.current.has('arrowright')) x += MOVE_SPEED
          // Cancel click-to-move when using keyboard
          setTargetPos(null)
        }
        // Click-to-move
        else if (targetPos) {
          const dx = targetPos.x - x
          const dy = targetPos.y - y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < MOVE_SPEED) {
            // Reached target
            x = targetPos.x
            y = targetPos.y
            setTargetPos(null)
          } else {
            // Move towards target
            const angle = Math.atan2(dy, dx)
            x += Math.cos(angle) * MOVE_SPEED
            y += Math.sin(angle) * MOVE_SPEED
          }
        }

        // Clamp to room bounds (with margin for sprite)
        x = Math.max(30, Math.min(ROOM_WIDTH - 30, x))
        y = Math.max(70, Math.min(ROOM_HEIGHT - 30, y))

        return { x, y }
      })

      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [targetPos])

  // Proximity detection
  const nearbyAgent = agents.find((agent) => {
    const pos = AGENT_POSITIONS[agent.name.toLowerCase()]
    if (!pos) return false
    const dist = Math.sqrt((playerPos.x - pos.x) ** 2 + (playerPos.y - pos.y) ** 2)
    return dist < INTERACTION_RADIUS
  }) || null

  return (
    <div
      ref={floorRef}
      className="relative bg-zinc-950 border-2 border-amber-900/30 rounded-lg overflow-hidden cursor-crosshair"
      style={{
        width: `${ROOM_WIDTH}px`,
        height: `${ROOM_HEIGHT}px`,
        background: `
          linear-gradient(135deg, rgba(139, 119, 82, 0.04) 25%, transparent 25%),
          linear-gradient(225deg, rgba(139, 119, 82, 0.04) 25%, transparent 25%),
          linear-gradient(315deg, rgba(139, 119, 82, 0.04) 25%, transparent 25%),
          linear-gradient(45deg, rgba(139, 119, 82, 0.04) 25%, transparent 25%),
          linear-gradient(rgba(63, 63, 70, 0.15) 1px, transparent 1px),
          linear-gradient(90deg, rgba(63, 63, 70, 0.15) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px, 80px 80px, 80px 80px, 80px 80px, 40px 40px, 40px 40px',
        backgroundColor: 'rgb(12, 12, 14)',
      }}
      onClick={handleFloorClick}
    >
      {/* Cherry blossom petals - decorative */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute opacity-20"
            style={{
              left: `${10 + (i * 12) % 90}%`,
              top: `-20px`,
              fontSize: '14px',
              animation: `fall ${8 + i * 2}s linear infinite`,
              animationDelay: `${i * 1.5}s`,
            }}
          >
            🌸
          </div>
        ))}
      </div>

      {/* Corner posts */}
      {[
        { top: 8, left: 8 },
        { top: 8, right: 8 },
        { bottom: 8, left: 8 },
        { bottom: 8, right: 8 },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute size-3 rounded-sm bg-amber-900/20 border border-amber-800/20 pointer-events-none"
          style={pos as React.CSSProperties}
        />
      ))}

      {/* Mission board */}
      <MissionBoard
        missions={missions}
        position={MISSION_BOARD_POSITION}
        onExpand={onBoardClick}
      />

      {/* Agents */}
      {agents.map((agent) => {
        const pos = AGENT_POSITIONS[agent.name.toLowerCase()]
        if (!pos) return null
        return (
          <DojoAgent
            key={agent.id}
            agent={agent}
            position={pos}
            isNearby={nearbyAgent?.id === agent.id}
            ringColor={agentRingColors?.[agent.name.toLowerCase()]}
            onClick={onAgentClick}
          />
        )
      })}

      {/* Player */}
      <DojoPlayer position={playerPos} />

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 bg-zinc-900/80 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-400 font-[family-name:var(--font-jetbrains-mono)] select-none">
        <div className="flex gap-4">
          <span>WASD / Arrows: Move</span>
          <span>Click: Walk to</span>
          <span>A: Interact</span>
        </div>
      </div>
    </div>
  )
}
