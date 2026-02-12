"use client"

interface DojoPlayerProps {
  position: { x: number; y: number }
}

export function DojoPlayer({ position }: DojoPlayerProps) {
  return (
    <div
      className="absolute pointer-events-none transition-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="relative">
        {/* Player sprite */}
        <div className="text-4xl select-none">🥷</div>
        {/* Shadow */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/40 rounded-full blur-sm" />
      </div>
    </div>
  )
}
