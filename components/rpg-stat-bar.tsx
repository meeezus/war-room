"use client"

import { motion } from "motion/react"

interface RpgStatBarProps {
  label: string
  value: number  // 0-100
  color?: string
  showValue?: boolean
}

const STAT_COLORS: Record<string, string> = {
  SPD: "#3b82f6", // blue
  TRU: "#10b981", // green
  WIS: "#8b5cf6", // purple
  CRE: "#f59e0b", // amber
  // Domain-specific will use a gradient
  default: "#6b7280", // gray
}

export function RpgStatBar({ label, value, color, showValue = true }: RpgStatBarProps) {
  const statColor = color || STAT_COLORS[label] || STAT_COLORS.default
  const percentage = Math.min(100, Math.max(0, value))

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-wider text-foreground/60">
          {label}
        </span>
        {showValue && (
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-muted-foreground">
            {Math.round(percentage)}
          </span>
        )}
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            backgroundColor: statColor,
            boxShadow: `0 0 8px ${statColor}66, 0 0 4px ${statColor}99`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {/* Glow effect overlay */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full opacity-60"
          style={{
            background: `linear-gradient(90deg, transparent, ${statColor}66, transparent)`,
            width: `${percentage}%`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

interface RpgStatsDisplayProps {
  stats: {
    label: string
    value: number
    color?: string
  }[]
  compact?: boolean
}

export function RpgStatsDisplay({ stats, compact = false }: RpgStatsDisplayProps) {
  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
      {stats.map((stat) => (
        <RpgStatBar
          key={stat.label}
          label={stat.label}
          value={stat.value}
          color={stat.color}
          showValue={!compact}
        />
      ))}
    </div>
  )
}
