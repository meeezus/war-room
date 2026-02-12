"use client";

interface RpgStatBarProps {
  label: string;
  value: number;
  maxValue?: number;
  color: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

export function RpgStatBar({
  label,
  value,
  maxValue = 99,
  color,
  size = "md",
}: RpgStatBarProps) {
  const pct = Math.min((value / maxValue) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums">
        <span className="text-[rgba(255,255,255,0.5)]">{label}</span>
        <span className="text-[#E5E5E5]">{value}</span>
      </div>
      <div className={`w-full rounded-full bg-zinc-800 ${sizeClasses[size]}`}>
        <div
          className={`rounded-full ${sizeClasses[size]}`}
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}40`,
          }}
        />
      </div>
    </div>
  );
}
